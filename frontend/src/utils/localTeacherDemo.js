// El perfil docente fija este origen en infra/local-demo/profile.cjs.
// La API aplica la restricción por NC_LOCAL_DEMO; esto solo adapta la interfaz.
export const isLocalTeacherDemo = (origin = window.location.origin) => origin === 'https://127.0.0.2:9445';
