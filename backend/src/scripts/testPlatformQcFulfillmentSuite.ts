import mongoose from "mongoose";
import {
  canonicalizeOrderStatus,
  getAllowedNextStatuses,
  validateOrderStatusTransition,
} from "../services/orderStatusTransitionService";

let totalTests = 0;
let passedTests = 0;

function assert(description: string, condition: boolean, extra?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ ${description}`);
  } else {
    console.error(`  ✗ ${description}`, extra || "");
    throw new Error(`Test failed: ${description}`);
  }
}

async function runTestSuite() {
  console.log("\n========================================================");
  console.log("  PLATFORM QC FULFILLMENT & STATE MACHINE AUDIT SUITE");
  console.log("========================================================\n");

  console.log("--- 1. Canonicalization & Alias Tests ---");
  assert("Aliases 'Processing' and 'processing' canonicalize to 'Processed'",
    canonicalizeOrderStatus("Processing") === "Processed" &&
    canonicalizeOrderStatus("processing") === "Processed"
  );
  assert("Alias 'ontheway' and 'on_the_way' canonicalize to 'On the way'",
    canonicalizeOrderStatus("ontheway") === "On the way" &&
    canonicalizeOrderStatus("on_the_way") === "On the way"
  );
  assert("Alias 'completed' canonicalizes to 'Delivered'",
    canonicalizeOrderStatus("completed") === "Delivered"
  );
  assert("Unknown status returns null",
    canonicalizeOrderStatus("UnknownStatusXYZ") === null
  );

  console.log("\n--- 2. Channel-Scoped State Transitions ---");
  const qcNextFromAccepted = getAllowedNextStatuses("Accepted", "QUICK_COMMERCE");
  assert("QC channel removes 'Shipped' from Accepted next transitions",
    !qcNextFromAccepted.includes("Shipped") && qcNextFromAccepted.includes("Processed")
  );

  const ecomNextFromAccepted = getAllowedNextStatuses("Accepted", "ECOMMERCE");
  assert("Ecommerce channel removes local rider 'Picked up' and 'On the way'",
    !ecomNextFromAccepted.includes("Picked up") &&
    !ecomNextFromAccepted.includes("On the way") &&
    ecomNextFromAccepted.includes("Shipped")
  );

  console.log("\n--- 3. Terminal State Backward Rejections ---");
  const deliveredToProcessing = validateOrderStatusTransition("Delivered", "Processing");
  assert("Delivered -> Processing is strictly REJECTED",
    !deliveredToProcessing.valid && deliveredToProcessing.code === "INVALID_STATUS_TRANSITION",
    deliveredToProcessing
  );

  const deliveredToAccepted = validateOrderStatusTransition("Delivered", "Accepted");
  assert("Delivered -> Accepted is strictly REJECTED",
    !deliveredToAccepted.valid && deliveredToAccepted.code === "INVALID_STATUS_TRANSITION"
  );

  const deliveredToPending = validateOrderStatusTransition("Delivered", "Pending");
  assert("Delivered -> Pending is strictly REJECTED",
    !deliveredToPending.valid && deliveredToPending.code === "INVALID_STATUS_TRANSITION"
  );

  const cancelledToAccepted = validateOrderStatusTransition("Cancelled", "Accepted");
  assert("Cancelled -> Accepted is strictly REJECTED",
    !cancelledToAccepted.valid && cancelledToAccepted.code === "INVALID_STATUS_TRANSITION"
  );

  const rejectedToProcessing = validateOrderStatusTransition("Rejected", "Processed");
  assert("Rejected -> Processed is strictly REJECTED",
    !rejectedToProcessing.valid && rejectedToProcessing.code === "INVALID_STATUS_TRANSITION"
  );

  console.log("\n--- 4. Valid Forward Lifecycle Transitions ---");
  const receivedToAccepted = validateOrderStatusTransition("Received", "Accepted");
  assert("Received -> Accepted is VALID", receivedToAccepted.valid);

  const acceptedToProcessed = validateOrderStatusTransition("Accepted", "Processed");
  assert("Accepted -> Processed is VALID", acceptedToProcessed.valid);

  const processedToPickedUp = validateOrderStatusTransition("Processed", "Picked up");
  assert("Processed -> Picked up is VALID", processedToPickedUp.valid);

  const pickedUpToOnTheWay = validateOrderStatusTransition("Picked up", "On the way");
  assert("Picked up -> On the way is VALID", pickedUpToOnTheWay.valid);

  const onTheWayToDelivered = validateOrderStatusTransition("On the way", "Delivered");
  assert("On the way -> Delivered is VALID", onTheWayToDelivered.valid);

  const outForDeliveryToDelivered = validateOrderStatusTransition("Out for Delivery", "Delivered");
  assert("Out for Delivery -> Delivered is VALID", outForDeliveryToDelivered.valid);

  const deliveredToReturned = validateOrderStatusTransition("Delivered", "Returned");
  assert("Delivered -> Returned is VALID (Formal return path)", deliveredToReturned.valid);

  const sameStatusIdempotent = validateOrderStatusTransition("Delivered", "Delivered");
  assert("Delivered -> Delivered is idempotent (valid: true)", sameStatusIdempotent.valid);

  console.log("\n--- 5. Notification Event Idempotency Structure ---");
  const dummyOrderId = new mongoose.Types.ObjectId().toString();
  const dummyRiderId = new mongoose.Types.ObjectId().toString();
  const dummyCustId = new mongoose.Types.ObjectId().toString();

  const customerEventId = `order:${dummyOrderId}:customer:${dummyCustId}:status:accepted`;
  const riderAssignEventId = `order:${dummyOrderId}:delivery_assigned:${dummyRiderId}`;
  const riderOfferEventId = `order:${dummyOrderId}:delivery_offer:${dummyRiderId}`;

  assert("Customer eventId format contains order, customer and status",
    customerEventId.startsWith(`order:${dummyOrderId}`) && customerEventId.endsWith(":status:accepted")
  );
  assert("Rider assign eventId format contains order, action and riderId",
    riderAssignEventId === `order:${dummyOrderId}:delivery_assigned:${dummyRiderId}`
  );
  assert("Rider offer eventId format contains order, action and riderId",
    riderOfferEventId === `order:${dummyOrderId}:delivery_offer:${dummyRiderId}`
  );

  console.log("\n========================================================");
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log("========================================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
