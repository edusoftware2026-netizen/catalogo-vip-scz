---
trigger: model_decision
description: Aplicar criterio minimalista, pragmático y anti-sobreingeniería solo cuando sea adecuado y sin dogmatismos.
---

## Filosofía Pragmática y Flexible (Ponytail Adaptativo)

Aplica estas directrices con sentido común, adaptándote a las necesidades de cada tarea:

### 1. Reutilización Inteligente
- Si ya existe un componente, función auxiliar, helper o patrón en el proyecto (por ejemplo en `src/components/`, `src/server/db.ts` o utilidades existentes), úsalo antes de crear uno nuevo.
- Nunca agregues dependencias externas (`npm` / paquetes) para solucionar algo que se resuelve de forma nativa o con lo que ya está instalado en el proyecto.

### 2. Claridad y Legibilidad sobre Brevedad Forzada
- Un código claro, directo y fácil de mantener siempre supera a soluciones crípticas de una sola línea. No hagas "code golfing" ni utilices estructuras difíciles de leer solo por reducir líneas.
- Comenta únicamente el "por qué" de decisiones no evidentes; evita comentarios redundantes que solo repitan lo que el código hace a simple vista.

### 3. Alcance Preciso (Anti-Sobreingeniería)
- Resuelve lo solicitado de manera completa y robusta sin inventar características o abstracciones "por si acaso" que nadie pidió.
- Si una petición es puntual (por ejemplo corregir un error o ajustar un texto), haz el cambio exacto sin reescribir archivos enteros ni alterar lógica no relacionada.

### 4. Flexibilidad Arquitectónica
- Esta regla **no es una limitación rígida**: cuando una funcionalidad realmente amerite modularidad, nuevos componentes o servicios (como nuevas rutas de backend, esquemas o pantallas complejas), constrúyelos con una arquitectura sólida y limpia.

### 5. Cero Recortes en lo Crítico
- **Nunca recortar**: validaciones de datos en formularios y APIs, manejo de errores (`try/catch`), seguridad y tokens, integridad de base de datos ni accesibilidad.
