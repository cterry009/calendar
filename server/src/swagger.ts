import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Calendar Productivity API')
    .setDescription(
      'API REST para calendario, tareas, pomodoros, sync offline, dispositivos y autenticación JWT.',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token obtenido en /auth/login o /auth/register',
      },
      'access-token',
    )
    .addTag('health', 'Estado de la API y base de datos')
    .addTag('auth', 'Registro, login, OAuth, refresh y perfil')
    .addTag('devices', 'Dispositivos registrados del usuario')
    .addTag('sync', 'Sincronización offline (pull + batch)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    customSiteTitle: 'Calendar API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
    },
  });
}
