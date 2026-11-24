import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import {
  CategoriaPasajero,
  OperacionesService,
} from './operaciones.service';

@Controller('operaciones')
export class OperacionesController {
  constructor(private readonly operacionesService: OperacionesService) {}

  @Get('estado')
  obtenerEstado() {
    return this.operacionesService.obtenerEstadoOperativo();
  }

  @Get('validar-micro')
  validarMicro(@Query('identificador') identificador: string) {
    return this.operacionesService.validarUnidad(identificador);
  }

  @Post('abordaje')
  registrarAbordaje(
    @Body()
    body: {
      identificadorMicro: string;
      categoriaPasajero: CategoriaPasajero;
    },
  ) {
    return this.operacionesService.registrarAbordaje(body);
  }

  @Post('trasbordo-emergencia')
  trasbordoEmergencia(
    @Body()
    body: {
      microOrigenId: number;
      motivo: string;
      microDestinoId?: number;
    },
  ) {
    return this.operacionesService.reportarIncidenciaYTrasbordar(body);
  }
}