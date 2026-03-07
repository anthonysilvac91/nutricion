import { Test, TestingModule } from '@nestjs/testing';
import { ContextResolverService } from './context-resolver.service';

describe('ContextResolverService', () => {
  let service: ContextResolverService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContextResolverService],
    }).compile();

    service = module.get<ContextResolverService>(ContextResolverService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
