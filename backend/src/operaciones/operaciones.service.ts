import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type CategoriaPasajero =
  | 'GENERAL'
  | 'ESTUDIANTE'
  | 'ESTUDIANTE_MENORES'
  | 'TERCERA_EDAD';

@Injectable()
export class OperacionesService {
  constructor(private readonly db: DatabaseService) {}

  private extraerFilas(resultado: any): any[] {
    if (Array.isArray(resultado)) {
      return resultado;
    }
    if (resultado && Array.isArray(resultado.rows)) {
      return resultado.rows;
    }
    return [];
  }

  private calcularEstadoAforo(ocupacionActual: number, capacidad: number) {
    const porcentaje = capacidad > 0 ? (ocupacionActual / capacidad) * 100 : 0;
    let estadoAforo: 'DISPONIBLE' | 'MEDIO_LLENO' | 'LLENO' = 'DISPONIBLE';
    if (ocupacionActual >= capacidad) {
      estadoAforo = 'LLENO';
    } else if (porcentaje >= 50) {
      estadoAforo = 'MEDIO_LLENO';
    }
    return {
      ocupacionActual,
      capacidad,
      cuposDisponibles: Math.max(capacidad - ocupacionActual, 0),
      estadoAforo,
    };
  }

  async obtenerEstadoOperativo() {
    const microsRes = await this.db.query(
      `SELECT m.id, m.placa, m.interno, m.capacidad, m.ocupacion_actual,
              m.estado, m.incidencia_motivo, m.linea_id,
              l.nombre AS linea_nombre, l.zona AS linea_zona, l.color AS linea_color
       FROM micros m
       JOIN lineas l ON l.id = m.linea_id
       ORDER BY m.id ASC`,
    );

    const tarifasRes = await this.db.query(
      `SELECT id, categoria, descripcion, monto
       FROM tarifas
       ORDER BY CASE categoria
         WHEN 'GENERAL' THEN 1
         WHEN 'ESTUDIANTE' THEN 2
         WHEN 'ESTUDIANTE_MENORES' THEN 3
         WHEN 'TERCERA_EDAD' THEN 4
         ELSE 99
       END ASC`,
    );

    const historialRes = await this.db.query(
      `SELECT v.id, v.codigo_comprobante, v.micro_id, m.interno, m.placa,
              l.nombre AS linea_nombre, v.categoria_pasajero, v.tarifa_aplicada,
              v.estado_viaje, v.creado_en
       FROM viajes_comprobantes v
       JOIN micros m ON m.id = v.micro_id
       JOIN lineas l ON l.id = m.linea_id
       ORDER BY v.id DESC
       LIMIT 30`,
    );

    const filasMicros = this.extraerFilas(microsRes);
    const filasTarifas = this.extraerFilas(tarifasRes);
    const filasHistorial = this.extraerFilas(historialRes);

    const micros = filasMicros.map((m) => ({
      ...m,
      aforo: this.calcularEstadoAforo(
        Number(m.ocupacion_actual),
        Number(m.capacidad),
      ),
    }));

    return {
      micros,
      tarifas: filasTarifas,
      historial: filasHistorial,
    };
  }

  async validarUnidad(identificador: string) {
    const limpio = String(identificador || '').trim();
    if (!limpio) {
      throw new BadRequestException(
        'Debes indicar el número interno o placa del micro.',
      );
    }

    const res = await this.db.query(
      `SELECT m.id, m.placa, m.interno, m.capacidad, m.ocupacion_actual,
              m.estado, m.incidencia_motivo, m.linea_id, l.nombre AS linea_nombre
       FROM micros m
       JOIN lineas l ON l.id = m.linea_id
       WHERE LOWER(m.interno) = LOWER($1) OR LOWER(m.placa) = LOWER($1)
       LIMIT 1`,
      [limpio],
    );

    const filas = this.extraerFilas(res);
    if (filas.length === 0) {
      throw new NotFoundException(
        `No existe ningún micro con interno o placa "${limpio}".`,
      );
    }

    const micro = filas[0];
    const operable = micro.estado === 'ACTIVO';
    const aforo = this.calcularEstadoAforo(
      Number(micro.ocupacion_actual),
      Number(micro.capacidad),
    );

    return {
      valido: operable && aforo.estadoAforo !== 'LLENO',
      operable,
      motivoBloqueo: !operable
        ? `Unidad en estado ${micro.estado}${micro.incidencia_motivo ? `: ${micro.incidencia_motivo}` : ''}.`
        : aforo.estadoAforo === 'LLENO'
          ? 'La unidad alcanzó su capacidad máxima de pasajeros.'
          : null,
      micro: {
        ...micro,
        aforo,
      },
    };
  }

  async registrarAbordaje(body: {
    identificadorMicro: string;
    categoriaPasajero: CategoriaPasajero;
  }) {
    const categoriasPermitidas: CategoriaPasajero[] = [
      'GENERAL',
      'ESTUDIANTE',
      'ESTUDIANTE_MENORES',
      'TERCERA_EDAD',
    ];

    const categoria = String(body?.categoriaPasajero || '')
      .trim()
      .toUpperCase() as CategoriaPasajero;

    if (!categoriasPermitidas.includes(categoria)) {
      throw new BadRequestException(
        'Categoría inválida. Usa GENERAL, ESTUDIANTE, ESTUDIANTE_MENORES o TERCERA_EDAD.',
      );
    }

    const validacion = await this.validarUnidad(body?.identificadorMicro);
    const micro = validacion.micro;

    if (!validacion.operable) {
      throw new BadRequestException(
        validacion.motivoBloqueo ||
          'La unidad no está activa para recibir pasajeros.',
      );
    }

    if (Number(micro.ocupacion_actual) >= Number(micro.capacidad)) {
      throw new BadRequestException(
        `Aforo completo en el micro interno ${micro.interno} (${micro.ocupacion_actual}/${micro.capacidad}).`,
      );
    }

    const tarifaRes = await this.db.query(
      `SELECT categoria, monto FROM tarifas WHERE categoria = $1 LIMIT 1`,
      [categoria],
    );
    const filasTarifa = this.extraerFilas(tarifaRes);
    if (filasTarifa.length === 0) {
      throw new NotFoundException(
        `No se encontró tarifa configurada para ${categoria}.`,
      );
    }

    const tarifaAplicada = Number(filasTarifa[0].monto);
    const nuevaOcupacion = Number(micro.ocupacion_actual) + 1;
    const codigoComprobante = `COMP-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;

    await this.db.query(`UPDATE micros SET ocupacion_actual = $1 WHERE id = $2`, [
      nuevaOcupacion,
      micro.id,
    ]);

    const insertRes = await this.db.query(
      `INSERT INTO viajes_comprobantes
        (codigo_comprobante, micro_id, categoria_pasajero, tarifa_aplicada, estado_viaje)
       VALUES ($1, $2, $3, $4, 'ACTIVO')
       RETURNING *`,
      [codigoComprobante, micro.id, categoria, tarifaAplicada],
    );
    const insertFilas = this.extraerFilas(insertRes);

    return {
      comprobante: insertFilas[0] || {
        codigo_comprobante: codigoComprobante,
        micro_id: micro.id,
        categoria_pasajero: categoria,
        tarifa_aplicada: tarifaAplicada,
        estado_viaje: 'ACTIVO',
      },
      micro: {
        ...micro,
        ocupacion_actual: nuevaOcupacion,
        aforo: this.calcularEstadoAforo(nuevaOcupacion, Number(micro.capacidad)),
      },
    };
  }

  async reportarIncidenciaYTrasbordar(body: {
    microOrigenId: number;
    motivo: string;
    microDestinoId?: number;
  }) {
    const origenId = Number(body?.microOrigenId);
    const motivo = String(body?.motivo || 'Falla mecánica o emergencia').trim();

    if (!origenId) {
      throw new BadRequestException(
        'Debes seleccionar el micro con incidencia.',
      );
    }

    const origenRes = await this.db.query(
      `SELECT * FROM micros WHERE id = $1 LIMIT 1`,
      [origenId],
    );
    const origenFilas = this.extraerFilas(origenRes);
    if (origenFilas.length === 0) {
      throw new NotFoundException('Micro de origen no encontrado.');
    }
    const origen = origenFilas[0];

    await this.db.query(
      `UPDATE micros
       SET estado = 'MANTENIMIENTO', incidencia_motivo = $1
       WHERE id = $2`,
      [motivo, origenId],
    );

    let pasajerosTrasbordados = 0;
    let destinoInfo: any = null;

    if (body?.microDestinoId) {
      const destinoId = Number(body.microDestinoId);
      if (destinoId === origenId) {
        throw new BadRequestException(
          'El micro destino debe ser distinto al micro con incidencia.',
        );
      }

      const destinoRes = await this.db.query(
        `SELECT * FROM micros WHERE id = $1 LIMIT 1`,
        [destinoId],
      );
      const destinoFilas = this.extraerFilas(destinoRes);
      if (destinoFilas.length === 0) {
        throw new NotFoundException('Micro destino no encontrado.');
      }
      const destino = destinoFilas[0];

      if (destino.estado !== 'ACTIVO') {
        throw new BadRequestException(
          'El micro destino seleccionado no está ACTIVO.',
        );
      }

      const ocupacionOrigen = Number(origen.ocupacion_actual);
      const cuposDestino =
        Number(destino.capacidad) - Number(destino.ocupacion_actual);

      if (ocupacionOrigen > cuposDestino) {
        throw new BadRequestException(
          `El micro destino solo tiene ${cuposDestino} cupos libres y el origen tiene ${ocupacionOrigen} pasajeros.`,
        );
      }

      pasajerosTrasbordados = ocupacionOrigen;
      const nuevaOcupacionDestino =
        Number(destino.ocupacion_actual) + pasajerosTrasbordados;

      await this.db.query(
        `UPDATE micros SET ocupacion_actual = $1 WHERE id = $2`,
        [nuevaOcupacionDestino, destinoId],
      );

      await this.db.query(
        `UPDATE micros SET ocupacion_actual = 0 WHERE id = $1`,
        [origenId],
      );

      if (pasajerosTrasbordados > 0) {
        await this.db.query(
          `UPDATE viajes_comprobantes
           SET micro_id = $1, estado_viaje = 'TRASBORDADO'
           WHERE micro_id = $2 AND estado_viaje = 'ACTIVO'`,
          [destinoId, origenId],
        );
      }

      destinoInfo = {
        id: destino.id,
        interno: destino.interno,
        placa: destino.placa,
        nuevaOcupacion: nuevaOcupacionDestino,
        capacidad: destino.capacidad,
      };
    }

    return {
      microInhabilitadoId: origenId,
      estadoNuevo: 'MANTENIMIENTO',
      motivo,
      pasajerosTrasbordados,
      destino: destinoInfo,
    };
  }
}