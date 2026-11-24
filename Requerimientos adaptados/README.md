# Requisitos Adaptados — RUTABOL-SCZ
**Materia:** Tecnología Web I  
**Integrante:** Mario Muyba Nuñez  

## Requisitos Funcionales Implementados
1. **RF-04 (Validación del micro):** Verifica que el micro exista y esté operativo antes de registrar un abordaje/viaje (identificación por línea, interno/placa).
2. **RF-02 y RF-10 (Tarifa oficial por categoría):** Calcula el monto automáticamente según la categoría del pasajero (General vs. Estudiante) sin edición libre del conductor.
3. **RF-03 y RF-06 (Ocupación y control de aforo):** Muestra el estado de ocupación (*Disponible*, *Medio lleno*, *Lleno*) según capacidad y bloquea nuevos abordajes al llegar al límite.
4. **RF-12 (Comprobante e historial):** Genera un comprobante con código, unidad, categoría, tarifa y fecha, y guarda el historial en PostgreSQL.
5. **RF-13 (Incidencia y trasbordo de emergencia):** Permite marcar una unidad con incidencia/falla para bloquear nuevos abordajes y reasignar/trasbordar hacia otra unidad activa.