import { runPipeline } from '@/lib/pipeline';
import { getSessionFromRequest } from '@/lib/session';
import { getApproverEmail } from '@/lib/users';
import { sendApprovalEmail, sendDecisionEmail } from '@/lib/notificationService';
import { scheduleReminder } from '@/lib/reminderService';
import { prisma } from '@/lib/prisma';

export async function POST(req) {
  const session = getSessionFromRequest(req);
  const { text, request_id } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event, data) {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const { reqId, isAutoApproved, requiredApprover, enrichedRequest, result } = await runPipeline(
          { text, request_id, session },
          { onStep: event => send('step', event) },
        );

        // ── DB: persist request ──────────────────────────────────────────
        try {
          const requestData = {
            raw_text:          text,
            requester_id:      session?.id ?? null,
            status:            isAutoApproved ? 'APPROVED' : (requiredApprover ? 'PENDING_APPROVAL' : 'SUBMITTED'),
            required_approver: requiredApprover ?? null,
            category_l1:       enrichedRequest?.category_l1 ?? null,
            category_l2:       enrichedRequest?.category_l2 ?? null,
            quantity:          enrichedRequest?.quantity ?? null,
            budget_amount:     enrichedRequest?.budget_amount ?? null,
            currency:          enrichedRequest?.currency ?? null,
            countries:         enrichedRequest?.delivery_countries || [],
            pipeline_result:   result,
          };
          await prisma.request.upsert({
            where:  { id: reqId },
            update: requestData,
            create: { id: reqId, ...requestData },
          });
        } catch (e) {
          console.warn('[process-stream] DB request save failed, continuing:', e.message);
        }

        // ── DB: persist decision ─────────────────────────────────────────
        try {
          const decisionStatus = isAutoApproved ? 'APPROVED' : 'PENDING_APPROVAL';
          const decisionNotes  = isAutoApproved ? 'Auto-approved — tier 1, no escalations, no critical issues' : null;
          await prisma.decision.upsert({
            where:  { request_id: reqId },
            update: { status: decisionStatus, approver_id: null, notes: decisionNotes, decided_at: new Date() },
            create: { request_id: reqId, status: decisionStatus, approver_id: null, notes: decisionNotes, decided_at: new Date() },
          });
        } catch (e) {
          console.warn('[process-stream] Decision save failed, continuing:', e.message);
        }

        // ── Notifications ────────────────────────────────────────────────
        const summary  = [enrichedRequest.quantity, '×', enrichedRequest.category_l2, '·', enrichedRequest.currency, enrichedRequest.budget_amount?.toLocaleString()].filter(Boolean).join(' ');
        const decision = result.recommendation;

        await sendDecisionEmail({
          to:              'requester@company.com',
          requestId:       reqId,
          summary,
          status:          decision.status,
          aiDecision:      decision.decision_summary ?? '',
          justification:   decision.justification ?? '',
          topSupplier:     result.supplier_shortlist[0]?.supplier_name,
          confidenceScore: result.confidence_score,
        });

        if (!isAutoApproved && requiredApprover) {
          const approverEmail = getApproverEmail(requiredApprover) ?? 'approver@company.com';
          await sendApprovalEmail({
            to:            approverEmail,
            requestId:     reqId,
            approverName:  requiredApprover,
            summary,
            aiDecision:    decision.decision_summary ?? '',
            justification: decision.justification ?? '',
            escalations:   result.escalations,
          });
          scheduleReminder({ requestId: reqId, approverEmail, approverName: requiredApprover, summary });
        }

        send('result', result);
        controller.close();
      } catch (error) {
        send('error', { message: error.message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection':    'keep-alive',
    },
  });
}
