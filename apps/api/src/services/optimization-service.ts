import type { OrganizationRole, RoutingProposalInput } from "@idel-os/shared";
import { DomainError } from "@idel-os/shared";
import {
  buildRoutingDiff,
  collectRoutingLocations,
  withRoadMetrics,
  type FieldRoutingDiff,
  type FieldRoutingPlan,
  type FieldRoutingSolution,
  type RoadMatrixProvider,
  type VehicleOptimizer,
} from "@idel-os/routing";

export type StoredOptimizationProposal = {
  id: string;
  organizationId: string;
  anchorTourId: string;
  date: string;
  plan: FieldRoutingPlan;
  solution: FieldRoutingSolution;
  diff: FieldRoutingDiff;
  accepted: boolean;
};

export interface OptimizationRepository {
  loadPlan(
    organizationId: string,
    input: RoutingProposalInput,
  ): Promise<{ anchorTourId: string; plan: FieldRoutingPlan }>;
  saveProposal(proposal: StoredOptimizationProposal): Promise<void>;
  findProposal(organizationId: string, optimizationRunId: string): Promise<StoredOptimizationProposal | null>;
  applyProposal(organizationId: string, optimizationRunId: string, acceptedByUserId: string): Promise<void>;
}

type Actor = { userId: string; role: OrganizationRole };

export class OptimizationService {
  public constructor(
    private readonly repository: OptimizationRepository,
    private readonly roadMatrix: RoadMatrixProvider,
    private readonly optimizer: VehicleOptimizer,
    private readonly newId: () => string,
  ) {}

  public async propose(organizationId: string, actor: Actor, input: RoutingProposalInput) {
    assertCanOptimize(actor.role);
    const { anchorTourId, plan } = await this.repository.loadPlan(organizationId, input);
    if (plan.nurses.length === 0) throw new DomainError("ROUTING_NO_NURSE", "Aucune IDEL affectée à cette journée.");
    if (plan.stops.length === 0) throw new DomainError("ROUTING_NO_VISIT", "Aucun passage à optimiser.");
    const matrix = await this.roadMatrix.table(collectRoutingLocations(plan));
    const measuredPlan = withRoadMetrics(plan, matrix);
    const solution = await this.optimizer.solve(measuredPlan, matrix);
    if (solution.unassignedStopIds.length > 0) {
      throw new DomainError(
        "ROUTING_UNASSIGNED_VISITS",
        `${solution.unassignedStopIds.length} passage(s) ne respectent aucune tournée. Ajustez les contraintes avant application.`,
      );
    }
    const proposal: StoredOptimizationProposal = {
      id: this.newId(),
      organizationId,
      anchorTourId,
      date: input.date,
      plan: measuredPlan,
      solution,
      diff: buildRoutingDiff(measuredPlan, solution),
      accepted: false,
    };
    await this.repository.saveProposal(proposal);
    return publicProposal(proposal);
  }

  public async getProposal(organizationId: string, actor: Actor, optimizationRunId: string) {
    assertCanOptimize(actor.role);
    const proposal = await this.repository.findProposal(organizationId, optimizationRunId);
    if (proposal === null) throw new DomainError("ROUTING_PROPOSAL_NOT_FOUND", "Proposition d’optimisation introuvable.");
    return publicProposal(proposal);
  }

  public async apply(organizationId: string, actor: Actor, optimizationRunId: string) {
    assertCanOptimize(actor.role);
    const proposal = await this.repository.findProposal(organizationId, optimizationRunId);
    if (proposal === null) throw new DomainError("ROUTING_PROPOSAL_NOT_FOUND", "Proposition d’optimisation introuvable.");
    if (proposal.accepted) throw new DomainError("ROUTING_ALREADY_APPLIED", "Cette proposition a déjà été appliquée.");
    await this.repository.applyProposal(organizationId, optimizationRunId, actor.userId);
    return { ...publicProposal(proposal), accepted: true };
  }
}

function assertCanOptimize(role: OrganizationRole): void {
  if (role === "remplacant") {
    throw new DomainError("ROUTING_FORBIDDEN", "La validation d’une tournée multi-IDEL est réservée au cabinet.");
  }
}

function publicProposal(proposal: StoredOptimizationProposal) {
  return {
    optimizationRunId: proposal.id,
    date: proposal.date,
    accepted: proposal.accepted,
    assignments: proposal.solution.assignments,
    diff: proposal.diff,
  };
}
