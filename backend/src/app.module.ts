import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { LineasModule } from './lineas/lineas.module';
import { MicrosModule } from './micros/micros.module';
import { AuthModule } from './auth/auth.module';
import { OperacionesModule } from './operaciones/operaciones.module';

@Module({
  imports: [
    DatabaseModule,
    LineasModule,
    MicrosModule,
    AuthModule,
    OperacionesModule,
  ],
})
export class AppModule {}