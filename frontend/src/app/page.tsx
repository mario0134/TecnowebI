'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { EstadoMicro, Linea, Micro, MicroInput, Usuario } from '@/lib/types';

const inicial: MicroInput = { placa: '', interno: '', capacidad: 30, estado: 'ACTIVO', lineaId: 1 };
const estados: EstadoMicro[] = ['ACTIVO', 'MANTENIMIENTO', 'INACTIVO'];

export default function Home() {
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [micros, setMicros] = useState<Micro[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [editando, setEditando] = useState<number | null>(null);
  const [form, setForm] = useState<MicroInput>(inicial);
  const [guardando, setGuardando] = useState(false);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [revisandoSesion, setRevisandoSesion] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorLogin, setErrorLogin] = useState('');
  const [procesandoLogin, setProcesandoLogin] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const [listaLineas, listaMicros] = await Promise.all([api.lineas(), api.micros()]);
      setLineas(listaLineas);
      setMicros(listaMicros);
      setForm((actual) => ({ ...actual, lineaId: listaLineas.some(l => l.id === actual.lineaId) ? actual.lineaId : (listaLineas[0]?.id ?? 1) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar los datos');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    api.usuarioActual().then(setUsuario).catch(() => setUsuario(null)).finally(() => setRevisandoSesion(false));
  }, []);

  async function iniciarSesion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorLogin('');
    setProcesandoLogin(true);
    try {
      const datos = await api.login(username, password);
      setUsuario(datos);
      setPassword('');
      setAviso('Sesión iniciada correctamente.');
    } catch (e) {
      setErrorLogin(e instanceof Error ? e.message : 'No fue posible iniciar sesión');
    } finally { setProcesandoLogin(false); }
  }

  async function cerrarSesion() {
    setError('');
    try {
      await api.logout();
      setUsuario(null);
      setAviso('Sesión finalizada.');
      cancelar();
    } catch (e) { setError(e instanceof Error ? e.message : 'No fue posible cerrar sesión'); }
  }

  const microsFiltrados = useMemo(() => micros.filter((m) => {
    const coincideLinea = filtro === 'todas' || m.lineaId === Number(filtro);
    const texto = `${m.placa} ${m.interno}`.toLowerCase();
    return coincideLinea && texto.includes(busqueda.toLowerCase());
  }), [micros, filtro, busqueda]);

  function editar(m: Micro) {
    if (!usuario) return;
    setEditando(m.id);
    setForm({ placa: m.placa, interno: m.interno, capacidad: m.capacidad, estado: m.estado, lineaId: m.lineaId });
    setAviso('');
    document.getElementById('formulario')?.scrollIntoView({ behavior: 'smooth' });
  }

  function cancelar() {
    setEditando(null);
    setForm({ ...inicial, lineaId: lineas[0]?.id ?? 1 });
  }

  async function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!usuario) { setError('Debe iniciar sesión para modificar los datos.'); return; }
    setError('');
    setAviso('');
    setGuardando(true);
    try {
      if (editando === null) {
        await api.crearMicro(form);
        setAviso('Micro registrado correctamente.');
      } else {
        await api.actualizarMicro(editando, form);
        setAviso('Micro actualizado correctamente.');
      }
      cancelar();
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: number) {
    if (!usuario) return;
    if (!window.confirm('¿Eliminar este micro?')) return;
    setError('');
    setAviso('');
    try {
      await api.eliminarMicro(id);
      setAviso('Micro eliminado.');
      if (editando === id) cancelar();
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  return (
    <main>
      <header className="cabecera">
        <div className="contenedor nav">
          <div className="marca"><span className="simbolo">M</span><div><strong>Micros SCZ</strong><small>Tecnología Web I | Clase 8</small></div></div>
          <nav>
            <a href="#lineas">Líneas</a>
            <a href="#micros">Micros</a>
            <a href="#acceso">Acceso</a>
            <Link href="/operaciones" style={{ color: '#0f766e', fontWeight: 700 }}>Operaciones</Link>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="contenedor">
          <div className="etiqueta">NEXT.JS + NESTJS | API REST</div>
          <h1>Catálogo de líneas de micros <span>de Santa Cruz</span></h1>
          <p>Explora líneas de demostración, administra micros mediante CRUD y gestiona abordajes, tarifas, aforo y trasbordos.</p>
          <div className="heroacciones">
            <a className="boton principal" href="#lineas">Explorar líneas</a>
            <Link className="boton claro" href="/operaciones">Operaciones y Tarifas</Link>
            <a className="boton secundario" href="#acceso">Acceso administrativo</a>
          </div>
          <p className="advertencia">Los nombres y recorridos son ficticios; no representan información oficial de transporte.</p>
        </div>
      </section>

      <div className="contenedor contenido">
        {error && <div className="alerta error" role="alert">{error} <button onClick={() => void cargar()}>Reintentar</button></div>}
        {aviso && <div className="alerta exito" role="status">{aviso}</div>}

        <section id="lineas" className="seccion">
          <div className="seccionTitulo"><div><span className="sobre">CATÁLOGO PRINCIPAL</span><h2>Líneas disponibles</h2><p>Información simulada recibida desde el endpoint GET /api/lineas.</p></div><span className="contador">{lineas.length} líneas</span></div>
          <div className="tarjetas">
            {lineas.map((linea) => (
              <article className="tarjeta" key={linea.id} style={{ borderTopColor: linea.color }}>
                <div className="tarjetaIcono" style={{ backgroundColor: linea.color }}>L{linea.id}</div>
                <div className="tarjetaInfo"><h3>{linea.nombre}</h3><span className="zona">{linea.zona}</span><p>{linea.descripcion}</p><span className="chip">{micros.filter(m => m.lineaId === linea.id).length} micros registrados</span></div>
              </article>
            ))}
          </div>
          {cargando && <p>Cargando catálogo desde NestJS...</p>}
        </section>

        <section id="micros" className="seccion">
          <div className="seccionTitulo"><div><span className="sobre">GESTIÓN CRUD</span><h2>Registro de micros</h2><p>Consulta unidades en PostgreSQL. El acceso administrativo permite registrarlas, editarlas y eliminarlas.</p></div><span className="contador">{microsFiltrados.length} resultados</span></div>
          <div className="filtros">
            <input aria-label="Buscar por placa o interno" placeholder="Buscar por placa o número interno" value={busqueda} onChange={e => setBusqueda(e.target.value)} />
            <select aria-label="Filtrar por línea" value={filtro} onChange={e => setFiltro(e.target.value)}>
              <option value="todas">Todas las líneas</option>
              {lineas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
            <button className="boton secundario" onClick={() => void cargar()}>Actualizar</button>
          </div>
          <div className="tablaWrap"><table><thead><tr><th>Placa</th><th>Interno</th><th>Línea</th><th>Capacidad</th><th>Estado</th>{usuario && <th>Acciones</th>}</tr></thead><tbody>
            {microsFiltrados.map(m => <tr key={m.id}><td><strong>{m.placa}</strong></td><td>{m.interno}</td><td>{lineas.find(l => l.id === m.lineaId)?.nombre ?? 'Sin línea'}</td><td>{m.capacidad}</td><td><span className={`estado ${m.estado.toLowerCase()}`}>{m.estado}</span></td>{usuario && <td className="acciones"><button onClick={() => editar(m)}>Editar</button><button className="peligro" onClick={() => void eliminar(m.id)}>Eliminar</button></td>}</tr>)}
            {!microsFiltrados.length && <tr><td colSpan={usuario ? 6 : 5} className="vacio">No hay micros para mostrar.</td></tr>}
          </tbody></table></div>
        </section>

        <section id="acceso" className="seccion accesoSeccion">
          <div>
            <span className="sobre">AUTENTICACIÓN DE LA CLASE 8</span>
            <h2>Acceso administrativo</h2>
            <p>El catálogo es público, pero registrar, editar y eliminar micros requiere una sesión iniciada.</p>
          </div>
          {revisandoSesion ? <p>Comprobando sesión...</p> : usuario ? (
            <div className="panelAcceso">
              <p>Sesión iniciada: <strong>{usuario.username}</strong></p>
              <button type="button" className="boton secundario" onClick={() => void cerrarSesion()}>Cerrar sesión</button>
            </div>
          ) : (
            <form className="panelAcceso" onSubmit={(e) => void iniciarSesion(e)}>
              <label htmlFor="login-username">Usuario</label>
              <input id="login-username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} />
              <label htmlFor="login-password">Contraseña</label>
              <input id="login-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
              {errorLogin && <p className="mensajeError" role="alert">{errorLogin}</p>}
              <button className="boton principal" type="submit" disabled={procesandoLogin}>{procesandoLogin ? 'Ingresando...' : 'Iniciar sesión'}</button>
            </form>
          )}
        </section>

        {usuario && <section id="formulario" className="seccion formularioSeccion">
          <div><span className="sobre">FORMULARIO CONECTADO</span><h2>{editando === null ? 'Registrar nuevo micro' : `Editar micro #${editando}`}</h2><p>El formulario envía datos JSON a NestJS mediante POST o PATCH. Los datos se guardan en PostgreSQL y permanecen aunque reinicies NestJS.</p></div>
          <form className="formulario" onSubmit={(e) => void guardar(e)}>
            <label>Placa<input required maxLength={20} value={form.placa} onChange={e => setForm({...form, placa:e.target.value})} placeholder="SCZ-1234"/></label>
            <label>Número interno<input required maxLength={20} value={form.interno} onChange={e => setForm({...form, interno:e.target.value})} placeholder="M-07"/></label>
            <label>Capacidad<input required type="number" min={1} max={100} value={form.capacidad} onChange={e => setForm({...form, capacidad:Number(e.target.value)})}/></label>
            <label>Estado<select value={form.estado} onChange={e => setForm({...form, estado:e.target.value as EstadoMicro})}>{estados.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
            <label className="ancho">Línea<select required value={form.lineaId} onChange={e => setForm({...form, lineaId:Number(e.target.value)})}>{lineas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}</select></label>
            <div className="formAcciones"><button className="boton principal" type="submit" disabled={guardando || !lineas.length}>{guardando ? 'Guardando...' : editando === null ? 'Registrar micro' : 'Guardar cambios'}</button>{editando !== null && <button type="button" className="boton secundario" onClick={cancelar}>Cancelar</button>}</div>
          </form>
        </section>}
        <footer>Rutabol SCZ</footer>
      </div>
    </main>
  );
}
