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
