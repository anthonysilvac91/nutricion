import { Test, TestingModule } from '@nestjs/testing';
import { ClinicalCalculationEngineService } from './clinical-calculation-engine.service';

describe('ClinicalCalculationEngineService', () => {
  let service: ClinicalCalculationEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClinicalCalculationEngineService],
    }).compile();

    service = module.get<ClinicalCalculationEngineService>(ClinicalCalculationEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
