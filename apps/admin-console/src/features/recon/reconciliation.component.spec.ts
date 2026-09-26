import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReconciliationComponent } from './reconciliation.component';
import { of } from 'rxjs';

describe('ReconciliationComponent', () => {
  let component: ReconciliationComponent;
  let mockRoute: any;
  let mockRouter: any;

  beforeEach(() => {
    mockRoute = {
      queryParams: of({ tab: 'batches' }),
    };
    mockRouter = {
      navigate: vi.fn(),
    };
    component = new ReconciliationComponent(mockRoute, mockRouter);
  });

  it('should initialize with default active tab "batches"', () => {
    component.ngOnInit();
    expect(component.activeTab()).toBe('batches');
  });

  it('should update tab to "cases" when query parameter specifies cases', () => {
    mockRoute.queryParams = of({ tab: 'cases' });
    component = new ReconciliationComponent(mockRoute, mockRouter);
    component.ngOnInit();

    expect(component.activeTab()).toBe('cases');
  });

  it('should switch tabs and update route query parameter', () => {
    component.setTab('cases');

    expect(component.activeTab()).toBe('cases');
    expect(mockRouter.navigate).toHaveBeenCalledWith([], {
      relativeTo: mockRoute,
      queryParams: { tab: 'cases' },
      queryParamsHandling: 'merge',
    });
  });
});
