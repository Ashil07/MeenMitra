import type {
  AcknowledgeRequest,
  Alert,
  AlertCreateRequest,
  AlertListQuery,
  CooperativeOverview,
  DashboardSummary,
  Delivery,
  DeliveryRequest,
  FeedbackResponse,
  FeedbackResult,
  Forecast,
  ForecastRequest,
  HealthResponse,
  MlStatus,
  Pond,
  PondInput,
  PondListQuery,
  PondSummary,
  Scenario,
  WaterCheck,
  WaterCheckRequest,
} from "./types";

/** Every call the frontend makes. Implemented by the live HTTP client and the mock client. */
export interface MeenMitraApi {
  health(): Promise<HealthResponse>;
  getDashboard(): Promise<DashboardSummary>;

  listPonds(query?: PondListQuery): Promise<PondSummary[]>;
  getPond(id: string): Promise<Pond>;
  createPond(input: PondInput): Promise<Pond>;
  updatePond(id: string, input: Partial<PondInput>): Promise<Pond>;

  listScenarios(): Promise<Scenario[]>;
  runForecast(pondId: string, req: ForecastRequest): Promise<Forecast>;
  /** Resolves to null when the pond has no forecast yet. */
  getLatestForecast(pondId: string): Promise<Forecast | null>;

  listWaterChecks(pondId: string): Promise<WaterCheck[]>;
  submitWaterCheck(pondId: string, req: WaterCheckRequest): Promise<WaterCheck>;

  submitFeedback(pondId: string, response: FeedbackResponse): Promise<FeedbackResult>;

  listAlerts(query?: AlertListQuery): Promise<Alert[]>;
  getAlert(id: string): Promise<Alert>;
  createAlert(req: AlertCreateRequest): Promise<Alert>;
  sendAlert(id: string, req: DeliveryRequest): Promise<Delivery>;
  acknowledgeAlert(id: string, req: AcknowledgeRequest): Promise<Alert>;

  getCooperative(): Promise<CooperativeOverview>;
  getMlStatus(): Promise<MlStatus>;
}
