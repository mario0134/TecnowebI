'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

type CategoriaPasajero =
  | 'GENERAL'
  | 'ESTUDIANTE'
  | 'ESTUDIANTE_MENORES'
  | 'TERCERA_EDAD';

interface AforoInfo {
  ocupacionActual: number;
  capacidad: number;
  cuposDisponibles: number;
  estadoAforo: 'DISPONIBLE' | 'MEDIO_LLENO' | 'LLENO';
}

interface MicroItem {
  id: number;
  placa: string;
  interno: string;
  capacidad: number;
  ocupacion_actual: number;
  estado: string;
  incidencia_motivo: string | null;
  linea_id: number;
  linea_nombre: string;
  linea_zona: string;
  linea_color: string;
  aforo: AforoInfo;
}

interface TarifaItem {
  id: number;
  categoria: string;
  descripcion: string;
  monto: string | number;
}

interface ComprobanteItem {
  id: number;
  codigo_comprobante: string;
  micro_id: number;
  interno: string;
  placa: string;
  linea_nombre: string;
  categoria_pasajero: string;
  tarifa_aplicada: string | number;
  estado_viaje: string;
  creado_en: string;
}

export default function OperacionesPage() {
  const [micros, setMicros] = useState<MicroItem[]>([]);
  const [tarifas, setTarifas] = useState<TarifaItem[]>([]);
  const [historial, setHistorial] = useState<ComprobanteItem[]>([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState<{ tipo: 'ok' | 'err'; texto: string } | null>(null);

  const [identificador, setIdentificador] = useState('101');
  const [categoria, setCategoria] = useState<CategoriaPasajero>('GENERAL');
  const [resultadoValidacion, setResultadoValidacion] = useState<any>(null);
  const [ultimoComprobante, setUltimoComprobante] = useState<any>(null);

  const [microOrigenId, setMicroOrigenId] = useState<number>(1);
  const [motivoIncidencia, setMotivoIncidencia] = useState('Falla mecánica en motor');
  const [microDestinoId, setMicroDestinoId] = useState<number>(3);

  async function cargarDatos() {
    try {
      setCargando(true);
      const res = await fetch(`${API_BASE}/operaciones/estado`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        throw new Error(`Error ${res.status} al cargar estado operativo`);
      }
      const data = await res.json();
      setMicros(data.micros || []);
      setTarifas(data.tarifas || []);
      setHistorial(data.historial || []);

      const activos = (data.micros || []).filter((m: MicroItem) => m.estado === 'ACTIVO');
      if (activos.length > 0 && !microDestinoId) {
        setMicroDestinoId(activos[0].id);
      }
    } catch (err: any) {
      setMensaje({
        tipo: 'err',
        texto: err?.message || 'No se pudo conectar con el backend en puerto 3001.',
      });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, []);

  const tarifaActual = tarifas.find((t) => t.categoria === categoria);

  async function handleValidarMicro(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    setResultadoValidacion(null);
    try {
      const res = await fetch(
        `${API_BASE}/operaciones/validar-micro?identificador=${encodeURIComponent(identificador)}`,
        { cache: 'no-store' },
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'No se pudo validar el micro.');
      }
      setResultadoValidacion(data);
    } catch (err: any) {
      setMensaje({ tipo: 'err', texto: err.message });
    }
  }

  async function handleRegistrarAbordaje(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    try {
      const res = await fetch(`${API_BASE}/operaciones/abordaje`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identificadorMicro: identificador,
          categoriaPasajero: categoria,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'No se pudo registrar el abordaje.');
      }
      setUltimoComprobante(data.comprobante);
      setMensaje({
        tipo: 'ok',
        texto: `Abordaje registrado. Comprobante ${data.comprobante.codigo_comprobante} por Bs ${Number(data.comprobante.tarifa_aplicada).toFixed(2)}.`,
      });
      await cargarDatos();
    } catch (err: any) {
      setMensaje({ tipo: 'err', texto: err.message });
    }
  }

  async function handleTrasbordo(e: React.FormEvent) {
    e.preventDefault();
    setMensaje(null);
    try {
      const res = await fetch(`${API_BASE}/operaciones/trasbordo-emergencia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          microOrigenId: Number(microOrigenId),
          motivo: motivoIncidencia,
          microDestinoId: microDestinoId ? Number(microDestinoId) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Error al registrar incidencia/trasbordo.');
      }
      setMensaje({
        tipo: 'ok',
        texto: `Unidad inhabilitada (${data.estadoNuevo}). Pasajeros trasbordados: ${data.pasajerosTrasbordados}.`,
      });
      await cargarDatos();
    } catch (err: any) {
      setMensaje({ tipo: 'err', texto: err.message });
    }
  }

  return (
    <main>
      <header className="cabecera">
        <div className="contenedor nav">
          <div className="marca">
            <span className="simbolo">M</span>
            <div>
              <strong>Micros SCZ</strong>
              <small>Operaciones, Tarifas y Trasbordo</small>
            </div>
          </div>
          <nav>
            <Link href="/">Catálogo y CRUD</Link>
            <a href="#aforo">Aforo</a>
            <a href="#abordaje">Abordaje</a>
            <a href="#trasbordo">Trasbordo</a>
          </nav>
        </div>
      </header>

      <section className="hero" style={{ padding: '44px 0 38px' }}>
        <div className="contenedor">
          <div className="etiqueta">MÓDULO OPERATIVO | RUTABOL-SCZ</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', margin: '10px 0' }}>
            Control de operación, <span>tarifas y aforo</span>
          </h1>
          <p style={{ margin: '0 0 18px' }}>
            Valida unidades, calcula tarifas oficiales por categoría, controla capacidad y registra comprobantes o trasbordos.
          </p>
          <div className="heroacciones" style={{ marginTop: 14 }}>
            <Link className="boton claro" href="/">
              Volver al catálogo y CRUD
            </Link>
          </div>
        </div>
      </section>

      <div className="contenedor contenido">
        {mensaje && (
          <div className={`alerta ${mensaje.tipo === 'ok' ? 'exito' : 'error'}`} role="alert">
            {mensaje.texto}
          </div>
        )}

        <section id="aforo" className="seccion">
          <div className="seccionTitulo">
            <div>
              <span className="sobre">RF-03, RF-06 Y RF-13</span>
              <h2>Estado de unidades y control de aforo</h2>
              <p>Ocupación actual frente a capacidad máxima y estado operativo de cada unidad.</p>
            </div>
            <span className="contador">{micros.length} unidades</span>
          </div>

          {cargando ? (
            <p>Cargando unidades...</p>
          ) : (
            <div className="tarjetas">
              {micros.map((m) => (
                <article
                  key={m.id}
                  className="tarjeta"
                  style={{ borderTopColor: m.linea_color || '#0f766e' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong>
                      #{m.interno} ({m.placa})
                    </strong>
                    <span className={`estado ${m.estado.toLowerCase()}`}>{m.estado}</span>
                  </div>
                  <div className="zona" style={{ marginTop: 8 }}>
                    {m.linea_nombre}
                  </div>
                  <p style={{ minHeight: 'auto', margin: '10px 0 6px' }}>
                    Aforo: <strong>{m.aforo.ocupacionActual}</strong> / {m.aforo.capacidad} ({m.aforo.estadoAforo})
                  </p>
                  <span className="chip">Cupos libres: {m.aforo.cuposDisponibles}</span>
                  {m.incidencia_motivo && (
                    <div style={{ fontSize: 12, color: '#b91c1c', marginTop: 8 }}>
                      Incidencia: {m.incidencia_motivo}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="abordaje" className="seccion formularioSeccion">
          <div>
            <span className="sobre">RF-02, RF-04, RF-10 Y RF-12</span>
            <h2>Validar micro, tarifa y abordar</h2>
            <p>
              Comprueba si la unidad está activa y con cupo, aplica la tarifa oficial según la categoría y emite un comprobante con código único.
            </p>
            {resultadoValidacion && (
              <div className="alerta exito" style={{ marginTop: 14 }}>
                <div>
                  Validación: <strong>{resultadoValidacion.valido ? 'APTO PARA ABORDAR' : 'BLOQUEADO'}</strong>
                </div>
                {resultadoValidacion.motivoBloqueo && (
                  <div style={{ color: '#991b1b', marginTop: 4 }}>{resultadoValidacion.motivoBloqueo}</div>
                )}
              </div>
            )}
            {ultimoComprobante && (
              <div className="alerta exito" style={{ marginTop: 14 }}>
                <div>
                  <strong>Último comprobante:</strong> {ultimoComprobante.codigo_comprobante}
                </div>
                <div>
                  Categoría: {ultimoComprobante.categoria_pasajero} | Monto: Bs{' '}
                  {Number(ultimoComprobante.tarifa_aplicada).toFixed(2)}
                </div>
              </div>
            )}
          </div>

          <form className="formulario" onSubmit={handleRegistrarAbordaje}>
            <label className="ancho">
              Número interno o placa del micro
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  placeholder="Ej: 101 o DEMO-001"
                  style={{ flex: 1 }}
                />
                <button type="button" className="boton secundario" onClick={handleValidarMicro}>
                  Validar
                </button>
              </div>
            </label>

            <label className="ancho">
              Categoría de pasajero (Tarifa automática)
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value as CategoriaPasajero)}
              >
                <option value="GENERAL">GENERAL</option>
                <option value="ESTUDIANTE">ESTUDIANTE</option>
                <option value="ESTUDIANTE_MENORES">ESTUDIANTE_MENORES</option>
                <option value="TERCERA_EDAD">TERCERA_EDAD</option>
              </select>
            </label>

            <div className="ancho" style={{ fontSize: 14, padding: 10, background: '#f5f8fa', borderRadius: 8 }}>
              Tarifa oficial calculada:{' '}
              <strong>Bs {tarifaActual ? Number(tarifaActual.monto).toFixed(2) : '0.00'}</strong>
            </div>

            <div className="formAcciones">
              <button type="submit" className="boton principal">
                Confirmar abordaje y emitir comprobante
              </button>
            </div>
          </form>
        </section>

        <section id="trasbordo" className="seccion formularioSeccion">
          <div>
            <span className="sobre">RF-13</span>
            <h2>Incidencia y trasbordo de emergencia</h2>
            <p>
              Inhabilita una unidad con falla (pasándola a MANTENIMIENTO) y trasborda sus pasajeros y comprobantes activos hacia otro micro ACTIVO con cupos libres.
            </p>
          </div>

          <form className="formulario" onSubmit={handleTrasbordo}>
            <label className="ancho">
              Micro con falla / incidencia (Origen)
              <select
                value={microOrigenId}
                onChange={(e) => setMicroOrigenId(Number(e.target.value))}
              >
                {micros.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.interno} — {m.linea_nombre} (Ocupación: {m.ocupacion_actual}/{m.capacidad})
                  </option>
                ))}
              </select>
            </label>

            <label className="ancho">
              Motivo de la incidencia
              <input
                type="text"
                value={motivoIncidencia}
                onChange={(e) => setMotivoIncidencia(e.target.value)}
              />
            </label>

            <label className="ancho">
              Micro destino para trasbordo
              <select
                value={microDestinoId}
                onChange={(e) => setMicroDestinoId(Number(e.target.value))}
              >
                <option value={0}>Solo inhabilitar unidad (sin trasbordo)</option>
                {micros
                  .filter((m) => m.estado === 'ACTIVO' && m.id !== Number(microOrigenId))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      #{m.interno} ({m.linea_nombre}) — Cupos libres: {m.aforo.cuposDisponibles}
                    </option>
                  ))}
              </select>
            </label>

            <div className="formAcciones">
              <button type="submit" className="boton secundario">
                Inhabilitar unidad y ejecutar trasbordo
              </button>
            </div>
          </form>
        </section>

        <section id="historial" className="seccion">
          <div className="seccionTitulo">
            <div>
              <span className="sobre">RF-12</span>
              <h2>Historial de comprobantes y viajes</h2>
              <p>Registro persistente en PostgreSQL de los abordajes emitidos y trasbordos realizados.</p>
            </div>
            <span className="contador">{historial.length} registros</span>
          </div>

          <div className="tablaWrap">
            <table>
              <thead>
                <tr>
                  <th>Comprobante</th>
                  <th>Micro</th>
                  <th>Línea</th>
                  <th>Categoría</th>
                  <th>Tarifa</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="vacio">
                      Aún no hay comprobantes registrados.
                    </td>
                  </tr>
                ) : (
                  historial.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.codigo_comprobante}</strong></td>
                      <td>#{item.interno} ({item.placa})</td>
                      <td>{item.linea_nombre}</td>
                      <td>{item.categoria_pasajero}</td>
                      <td>Bs {Number(item.tarifa_aplicada).toFixed(2)}</td>
                      <td><span className="estado activo">{item.estado_viaje}</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer>Rutabol SCZ</footer>
      </div>
    </main>
  );
}