/**
 * Runs the tests that live in each agent's folder (`agents/<id>/tests/*.spec.ts`). Vitest only
 * collects `lib/**` and `components/**`, so the agent specs register through this file.
 */
import "@/agents/payment-chaser/tests/parse.spec";
import "@/agents/payment-chaser/tests/run.spec";
import "@/agents/_test-digest/tests/digest.spec";
import "@/agents/payment-chaser/tests/import.spec";
import "@/agents/payment-chaser/tests/test-message.spec";
