import { Module } from '@nestjs/common';
import { ProjectChatController } from './project-chat.controller';
import { ProjectChatService } from './project-chat.service';

@Module({ controllers: [ProjectChatController], providers: [ProjectChatService] })
export class ProjectChatModule {}
