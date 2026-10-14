import React, { useId } from 'react';
import styles from './Documents.module.css';

function formatSize(bytes) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return null;
  const options = { maximumFractionDigits: 1 };
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('es-ES', options)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('es-ES', options)} MB`;
}

// Componente puro. NO sube nada ni guarda nada en el navegador: el contenedor
// hace la petición real cuando exista la API. Sin `available`, no ofrece ningún botón.
//   available: false por defecto (hasta que Backend fije el contrato de archivos)
//   status: 'idle' | 'selected' | 'uploading' | 'rejected' | 'error' | 'success'
//   fileName / fileSize: del archivo elegido (los pasa el contenedor)
//   message: motivo del rechazo (rejected) o del fallo técnico (error)
//   onSelect(file | null), onUpload(), onCancel()
// Rechazo = el servidor no acepta ESE archivo. Error = fallo técnico, se puede reintentar.
// El servidor valida de nuevo: cualquier comprobación del navegador es solo comodidad.
export default function DocumentUpload({
  available = false, status = 'idle', fileName = null, fileSize = null, message = null,
  accept, onSelect, onUpload, onCancel,
}) {
  const inputId = useId();

  if (!available) {
    return (
      <section className={styles.unit} aria-label="Subida de archivos">
        <p role="status">La subida de archivos todavía no está disponible.</p>
        <p className={styles.help}>
          No se guarda ningún archivo ni nombre de archivo en este navegador.
        </p>
      </section>
    );
  }

  const uploading = status === 'uploading';
  const hasFile = Boolean(fileName);
  const size = formatSize(fileSize);
  const showFile = hasFile && ['selected', 'uploading', 'rejected', 'error'].includes(status);

  const handleChange = event => {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    if (onSelect) onSelect(file);
    try { event.target.value = ''; } catch (e) { /* permite elegir el mismo archivo otra vez */ }
  };

  return (
    <section className={styles.unit} aria-label="Subida de archivos">
      <p className={styles.help}>
        El servidor valida de nuevo el tipo, el tamaño y el contenido del archivo.
      </p>

      <label className={styles.fieldLabel} htmlFor={inputId}>Elegir archivo</label>
      <input id={inputId} type="file" accept={accept} disabled={uploading} onChange={handleChange} />

      {showFile && (
        <p>Archivo elegido: <strong>{fileName}</strong>{size ? ` (${size})` : ''}</p>
      )}

      {uploading && <p role="status">Subiendo archivo...</p>}

      {status === 'rejected' && (
        <div className={styles.alert} role="alert">
          El archivo no se ha aceptado. {message || 'El servidor ha rechazado el archivo.'} Elige otro archivo.
        </div>
      )}

      {status === 'error' && (
        <div className={styles.alert} role="alert">
          {message || 'No se pudo subir el archivo. Inténtalo de nuevo.'}
        </div>
      )}

      {status === 'success' && (
        <p role="status">
          Archivo subido. Subirlo no valida su contenido; queda pendiente de revisión.
        </p>
      )}

      {showFile && (
        <div className={styles.actions}>
          {(status === 'selected' || uploading) && (
            <button type="button" className={styles.primary} disabled={uploading}
              onClick={() => onUpload && onUpload()}>
              Subir archivo
            </button>
          )}
          {status === 'error' && (
            <button type="button" className={styles.primary} onClick={() => onUpload && onUpload()}>
              Reintentar subida
            </button>
          )}
          <button type="button" className={styles.secondary} disabled={uploading}
            onClick={() => onCancel && onCancel()}>
            Quitar selección
          </button>
        </div>
      )}
    </section>
  );
}
