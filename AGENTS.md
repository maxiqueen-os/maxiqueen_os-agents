# 🤖 MAXIQUEEN OS - REGLAS GENERALES Y ARQUITECTURA DE AGENTES

Este archivo contiene las directrices estrictas para el desarrollo, comportamiento y automatización de los agentes inteligentes del ecosistema comercial familiar MaxiQueen. Cualquier IA o agente de desarrollo (ej. Claude Code) DEBE leer y acatar este manifiesto antes de modificar el código.

---

## 🛠️ 1. STACK TECNOLÓGICO Y REGLAS DE CÓDIGO
* **Frontend (Dashboard de Ventas):** Next.js (Estructura moderna con App Router).
* **Backend (Núcleo de Inteligencia):** Node.js directo y robusto.
* **Base de Datos:** MongoDB Atlas (Control de inventario, usuarios y logs).
* **Estética Visual:** Interfaz Cyberpunk futurista, elegante, Dark Mode nativo y acabados en Glassmorphic (efecto cristal).
* **PROHIBICIÓN ESTRICTA:** No utilizar Python, FastAPI ni Ollama para el chat o los conectores del ecosistema. Toda la lógica de comunicación con las APIs de LLMs (Gemini Failover) se ejecuta de forma nativa en Node.js.

---

## 💼 2. ESTRATEGIA COMERCIAL Y MODELO DE NEGOCIO
MaxiQueen OS opera como el motor de automatización para una microempresa familiar híbrida. Los agentes deben estar optimizados para dos frentes de monetización inmediata:

### A. MaxiQueen Store (Línea Física/Digital)
* **Producto:** Ropa y zapatos de alta calidad (Propiedad compartida familiar).
* **Objetivo del Agente:** Actuar como vendedor y cerrador por WhatsApp Business. Debe consultar el stock en MongoDB, mostrar imágenes optimizadas de las prendas a los clientes de Cúcuta y a nivel nacional, y generar el link de pago.

### B. Infoproductos y Automatización (Línea Digital en Hotmart)
* **Producto:** eBook de Automatización con IA y cursos especializados.
* **Objetivo del Agente:** Gestionar el post-venta. Escuchar los Webhooks de Hotmart cuando se procesa un pago exitoso, registrar al usuario en la base de datos y disparar sus credenciales de acceso de forma automática.

### C. Línea de Transporte Familiar
* **Recurso:** Gestión y monitoreo del flujo del taxi operado por el cuñado con el vehículo de la madre. El sistema debe contar con un módulo de registro de entregas diarias e ingresos para control interno.

---

## 🎯 3. FLUJO DE TRABAJO PARA EL AGENTE DE DESARROLLO (ROLES)
1.  **El Maestro (Usuario):** Dicta la visión estratégica, provee el hardware, la experiencia y aprueba los cambios arquitectónicos.
2.  **El Asistente (La IA):** Traduce las órdenes en código Node.js/Next.js limpio, funcional, libre de errores y enfocado 100% en la conversión de ventas.

*Nota de obsolescencia: Ignorar cualquier convención antigua de Next.js. Si una ruta o importación rompe la estructura del App Router actual, debe corregirse inmediatamente bajo advertencia.*
