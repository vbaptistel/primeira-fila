import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { TenantAwareRequest } from "../../common/tenancy/tenant-resolver.middleware";
import { ApiTags } from "@nestjs/swagger";
import { TenantRbacGuard } from "../../common/auth/tenant-rbac.guard";
import { TenantRoles } from "../../common/auth/roles.decorator";
import { CreateEventDayDto } from "./dto/create-event-day.dto";
import { CreateEventDto } from "./dto/create-event.dto";
import { CreateHoldDto } from "./dto/create-hold.dto";
import { CreateSessionDto } from "./dto/create-session.dto";
import { CreateSessionSeatDto } from "./dto/create-session-seat.dto";
import { UpdateEventDayDto } from "./dto/update-event-day.dto";
import { UpdateEventDto } from "./dto/update-event.dto";
import { UpdateSessionDto } from "./dto/update-session.dto";
import { UpdateSessionSeatDto } from "./dto/update-session-seat.dto";
import { EventsService } from "./events.service";

@ApiTags("events-admin")
@UseGuards(TenantRbacGuard)
@TenantRoles("organizer_admin", "platform_admin")
@Controller("tenants/:tenantId/events")
export class EventsAdminController {
  constructor(private readonly eventsService: EventsService) {}

  @Post()
  createEvent(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateEventDto
  ) {
    return this.eventsService.createEvent(tenantId, dto);
  }

  @Get()
  listTenantEvents(@Param("tenantId", ParseUUIDPipe) tenantId: string) {
    return this.eventsService.listTenantEvents(tenantId);
  }

  @Get(":eventId")
  getTenantEvent(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string
  ) {
    return this.eventsService.getTenantEvent(tenantId, eventId);
  }

  @Patch(":eventId")
  updateEvent(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: UpdateEventDto
  ) {
    return this.eventsService.updateEvent(tenantId, eventId, dto);
  }

  @Delete(":eventId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEvent(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string
  ) {
    await this.eventsService.deleteEvent(tenantId, eventId);
  }

  @Post(":eventId/days")
  createEventDay(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Body() dto: CreateEventDayDto
  ) {
    return this.eventsService.createEventDay(tenantId, eventId, dto);
  }

  @Get(":eventId/days")
  listEventDays(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string
  ) {
    return this.eventsService.listEventDays(tenantId, eventId);
  }

  @Get(":eventId/days/:eventDayId")
  getEventDay(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("eventDayId", ParseUUIDPipe) eventDayId: string
  ) {
    return this.eventsService.getEventDay(tenantId, eventId, eventDayId);
  }

  @Patch(":eventId/days/:eventDayId")
  updateEventDay(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("eventDayId", ParseUUIDPipe) eventDayId: string,
    @Body() dto: UpdateEventDayDto
  ) {
    return this.eventsService.updateEventDay(tenantId, eventId, eventDayId, dto);
  }

  @Delete(":eventId/days/:eventDayId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEventDay(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("eventDayId", ParseUUIDPipe) eventDayId: string
  ) {
    await this.eventsService.deleteEventDay(tenantId, eventId, eventDayId);
  }

  @Post(":eventId/days/:eventDayId/sessions")
  createSession(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("eventDayId", ParseUUIDPipe) eventDayId: string,
    @Body() dto: CreateSessionDto
  ) {
    return this.eventsService.createSession(tenantId, eventId, eventDayId, dto);
  }

  @Get(":eventId/days/:eventDayId/sessions")
  listSessions(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("eventDayId", ParseUUIDPipe) eventDayId: string
  ) {
    return this.eventsService.listSessions(tenantId, eventId, eventDayId);
  }

  @Get(":eventId/days/:eventDayId/sessions/:sessionId")
  getSession(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("eventDayId", ParseUUIDPipe) eventDayId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string
  ) {
    return this.eventsService.getSession(tenantId, eventId, eventDayId, sessionId);
  }

  @Patch(":eventId/days/:eventDayId/sessions/:sessionId")
  updateSession(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("eventDayId", ParseUUIDPipe) eventDayId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: UpdateSessionDto
  ) {
    return this.eventsService.updateSession(tenantId, eventId, eventDayId, sessionId, dto);
  }

  @Delete(":eventId/days/:eventDayId/sessions/:sessionId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("eventDayId", ParseUUIDPipe) eventDayId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string
  ) {
    await this.eventsService.deleteSession(tenantId, eventId, eventDayId, sessionId);
  }

  @Post(":eventId/days/:eventDayId/sessions/:sessionId/seats")
  createSessionSeat(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("eventDayId", ParseUUIDPipe) eventDayId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: CreateSessionSeatDto
  ) {
    return this.eventsService.createSessionSeat(tenantId, eventId, eventDayId, sessionId, dto);
  }

  @Get(":eventId/days/:eventDayId/sessions/:sessionId/seats")
  listSessionSeats(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("eventDayId", ParseUUIDPipe) eventDayId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string
  ) {
    return this.eventsService.listSessionSeats(tenantId, eventId, eventDayId, sessionId);
  }

  @Patch(":eventId/days/:eventDayId/sessions/:sessionId/seats/:seatId")
  updateSessionSeat(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("eventDayId", ParseUUIDPipe) eventDayId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("seatId", ParseUUIDPipe) seatId: string,
    @Body() dto: UpdateSessionSeatDto
  ) {
    return this.eventsService.updateSessionSeat(tenantId, eventId, eventDayId, sessionId, seatId, dto);
  }

  @Delete(":eventId/days/:eventDayId/sessions/:sessionId/seats/:seatId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSessionSeat(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Param("eventDayId", ParseUUIDPipe) eventDayId: string,
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Param("seatId", ParseUUIDPipe) seatId: string
  ) {
    await this.eventsService.deleteSessionSeat(tenantId, eventId, eventDayId, sessionId, seatId);
  }
}

@ApiTags("events")
@Controller("events")
export class EventsPublicController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  listPublicEvents(
    @Query("limit", new DefaultValuePipe(20), ParseIntPipe)
    limit: number,
    @Req() request: TenantAwareRequest
  ) {
    const tenantId = request.resolvedTenant?.id;
    return this.eventsService.listPublicEvents(limit, tenantId);
  }

  @Get(":eventId")
  getPublicEvent(
    @Param("eventId", ParseUUIDPipe) eventId: string,
    @Req() request: TenantAwareRequest
  ) {
    const tenantId = request.resolvedTenant?.id;
    return this.eventsService.getPublicEvent(eventId, tenantId);
  }
}

@ApiTags("sessions")
@Controller("sessions")
export class SessionsPublicController {
  constructor(private readonly eventsService: EventsService) {}

  @Post(":sessionId/holds")
  createHold(
    @Param("sessionId", ParseUUIDPipe) sessionId: string,
    @Body() dto: CreateHoldDto
  ) {
    return this.eventsService.createSessionHold(sessionId, dto);
  }

  @Get(":sessionId/seats")
  getPublicSessionSeats(@Param("sessionId", ParseUUIDPipe) sessionId: string) {
    return this.eventsService.getPublicSessionSeats(sessionId);
  }
}
