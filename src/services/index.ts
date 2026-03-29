export { composePrompt } from "./prompt-composer";
export type { PromptContext, ComposedPrompt } from "./prompt-composer";

export {
  executeResearch,
  saveResearchOutput,
  logProviderPath,
} from "./researcher";
export type {
  ResearchInput,
  ResearchResult,
  ResearchExecutionResult,
  TrendItem,
  CompetitorItem,
  PricingSignal,
  KeywordItem,
  AudienceNote,
} from "./researcher";

export {
  executeCreator,
  saveCreatorOutput,
} from "./creator";
export type {
  CreatorInput,
  CreatorResult,
  CreatorExecutionResult,
  ImagePrompt,
} from "./creator";

export {
  executePlatformAdapter,
  savePlatformVariants,
} from "./platform-adapter";
export type {
  PlatformAdapterInput,
  PlatformVariantResult,
  PlatformAdapterExecutionResult,
  PlatformAdapterBatchResult,
  SeoData,
} from "./platform-adapter";

export {
  executeMarketing,
  saveMarketingOutput,
} from "./marketing";
export type {
  MarketingInput,
  MarketingResult,
  MarketingExecutionResult,
  PriceSuggestion,
  SeoOptimization,
  MarketingDescriptions,
  MarketingCopy,
  CtaOptions,
  Positioning,
} from "./marketing";

export {
  executeSocial,
  saveSocialVariants,
} from "./social";
export type {
  SocialInput,
  SocialVariantResult,
  SocialExecutionResult,
  SocialBatchResult,
} from "./social";

export {
  executeReviewer,
  saveReviewerOutput,
  createAiReviewFromResult,
} from "./reviewer";
export type {
  ReviewerInput,
  ReviewerResult,
  ReviewerExecutionResult,
  ReviewIssue,
  ReviewSection,
} from "./reviewer";

export {
  executeRegeneration,
  listRegenerationHistory,
  REGENERATION_TARGETS,
} from "./regenerator";
export type {
  RegenerationInput,
  RegenerationResult,
  RegenerationTarget,
} from "./regenerator";

export {
  executePlanner,
  savePlannerOutput,
} from "./planner";
export type {
  PlannerInput,
  PlannerResult,
  PlannerExecutionResult,
  OutlineSection,
  ProductStructure,
  StagePlanItem,
  OfferArchitecture,
  PricingTier,
} from "./planner";

export {
  runPolicyCheck,
  getProductPolicyChecks,
  listPolicyRules,
  createPolicyRule,
  updatePolicyRule,
  deletePolicyRule,
  gatherProductContent,
} from "./risk-policy";
export type {
  PolicyRule,
  PolicyCheckResult,
  PolicyViolation,
  PolicyCheckInput,
} from "./risk-policy";

export {
  recordEvent,
  recordRoutingAttempts,
  recordStepTiming,
  recordApprovalEvent,
  recordCostEvent,
  getDashboardStats,
  getRunProviderPath,
  getRunEvents,
  getProviderBreakdown,
  ANALYTICS_EVENT_TYPES,
} from "./analytics";
export type {
  AnalyticsEvent,
  AnalyticsEventType,
  RoutingAuditInput,
  DashboardStats,
  ProviderUsageRow,
  StepTimingRow,
  ApprovalStatsRow,
  RoutingAuditRow,
  DailyTrendRow,
} from "./analytics";
