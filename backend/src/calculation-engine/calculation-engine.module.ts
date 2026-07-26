import { Module } from '@nestjs/common';
import { CALCULATION_STRATEGY } from './tokens';
import { CalculationStrategyRegistry } from './calculation-strategy-registry.service';

import { BmiAdultV1Strategy } from './strategies/adult/bmi-adult-v1.strategy';
import { BodyFatMeasuredV1Strategy } from './strategies/adult/body-fat-measured-v1.strategy';
import { TdeeBmrPalV1Strategy } from './strategies/adult/tdee-bmr-pal-v1.strategy';
import { BmrHarrisBenedictV1Strategy } from './strategies/adult/bmr/bmr-harris-benedict-v1.strategy';
import { BmrMifflinStJeorV1Strategy } from './strategies/adult/bmr/bmr-mifflin-st-jeor-v1.strategy';
import { BmrKatchMcArdleV1Strategy } from './strategies/adult/bmr/bmr-katch-mcardle-v1.strategy';
import { BmrOwenV1Strategy } from './strategies/adult/bmr/bmr-owen-v1.strategy';
import { MacroProteinGramsFromPercentV1Strategy } from './strategies/adult/macros/macro-protein-grams-from-percent-v1.strategy';
import { MacroCarbsGramsFromPercentV1Strategy } from './strategies/adult/macros/macro-carbs-grams-from-percent-v1.strategy';
import { MacroFatGramsFromPercentV1Strategy } from './strategies/adult/macros/macro-fat-grams-from-percent-v1.strategy';
import { MacroProteinGramsPerKgV1Strategy } from './strategies/adult/macros/macro-protein-grams-per-kg-v1.strategy';
import { FiberIomV1Strategy } from './strategies/adult/fiber/fiber-iom-v1.strategy';
import { FiberEfsaV1Strategy } from './strategies/adult/fiber/fiber-efsa-v1.strategy';
import { FiberWhoV1Strategy } from './strategies/adult/fiber/fiber-who-v1.strategy';
import { WaterIomV1Strategy } from './strategies/adult/water/water-iom-v1.strategy';
import { WaterEfsaV1Strategy } from './strategies/adult/water/water-efsa-v1.strategy';
import { WaterMlKgV1Strategy } from './strategies/adult/water/water-mlkg-v1.strategy';
import { BmiPediatricPendingStrategy } from './strategies/pediatric/bmi-pediatric-pending.strategy';

const STRATEGY_PROVIDERS = [
  BmiAdultV1Strategy,
  BodyFatMeasuredV1Strategy,
  TdeeBmrPalV1Strategy,
  BmrHarrisBenedictV1Strategy,
  BmrMifflinStJeorV1Strategy,
  BmrKatchMcArdleV1Strategy,
  BmrOwenV1Strategy,
  MacroProteinGramsFromPercentV1Strategy,
  MacroCarbsGramsFromPercentV1Strategy,
  MacroFatGramsFromPercentV1Strategy,
  MacroProteinGramsPerKgV1Strategy,
  FiberIomV1Strategy,
  FiberEfsaV1Strategy,
  FiberWhoV1Strategy,
  WaterIomV1Strategy,
  WaterEfsaV1Strategy,
  WaterMlKgV1Strategy,
  BmiPediatricPendingStrategy,
];

@Module({
  providers: [
    ...STRATEGY_PROVIDERS,
    {
      provide: CALCULATION_STRATEGY,
      useFactory: (...strategies: unknown[]) => strategies,
      inject: STRATEGY_PROVIDERS,
    },
    CalculationStrategyRegistry,
  ],
  exports: [CalculationStrategyRegistry],
})
export class CalculationEngineModule {}
