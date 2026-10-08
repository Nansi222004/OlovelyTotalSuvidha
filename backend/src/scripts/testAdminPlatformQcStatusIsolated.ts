import assert from "node:assert/strict";
import Order from "../models/Order";
import OrderItem from "../models/OrderItem";
import * as inventoryService from "../services/inventoryService";
import * as fulfillmentService from "../services/orderFulfillmentOrchestrator";
import { updateOrderStatus } from "../modules/admin/controllers/adminOrderController";

type MockResponse = {
  statusCode: number;
  body?: any;
  status: (code: number) => MockResponse;
  json: (body: any) => MockResponse;
};

function invoke(body: any): Promise<MockResponse> {
  return new Promise((resolve, reject) => {
    const req: any = {
      params: { id: "order-mixed-1" },
      body,
      user: { userId: "admin-1" },
      app: { get: () => ({}) },
    };
    const res: MockResponse = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(responseBody) {
        this.body = responseBody;
        resolve(this);
        return this;
      },
    };
    (updateOrderStatus as any)(req, res, reject);
  });
}

const originals = {
  orderFindById: Order.findById,
  itemUpdateMany: OrderItem.updateMany,
  itemFind: OrderItem.find,
  itemFindOneAndUpdate: OrderItem.findOneAndUpdate,
  itemUpdateOne: OrderItem.updateOne,
  recordReturn: inventoryService.recordReturn,
  recompute: fulfillmentService.recomputeOrderFulfillment,
};

const order: any = {
  _id: { toString: () => "order-mixed-1" },
  orderNumber: "ORD-MIXED-1",
  status: "Received",
};

const makeOrderQuery = () => {
  const query: any = {
    populate: () => query,
    then: (resolve: (value: any) => void) => Promise.resolve(order).then(resolve),
  };
  return query;
};

async function run() {
  let updateManyFilter: any;
  let updateManyUpdate: any;
  let recomputeCalls = 0;
  let returnCalls = 0;
  let pending = true;

  const platformQcItem: any = {
    _id: { toString: () => "platform-qc-item" },
    product: { toString: () => "platform-product" },
    variationId: undefined,
    quantity: 3,
    ownerType: "PLATFORM",
    productType: "QUICK_COMMERCE",
    sellerStatus: "Pending",
    status: "Pending",
  };

  (Order.findById as any) = () => makeOrderQuery();
  (fulfillmentService as any).recomputeOrderFulfillment = async () => {
    recomputeCalls += 1;
    return { outcome: "waiting_for_sellers" };
  };
  (OrderItem.updateMany as any) = async (filter: any, update: any) => {
    updateManyFilter = filter;
    updateManyUpdate = update;
    return { modifiedCount: 1 };
  };

  try {
    const accepted = await invoke({ status: "Accepted", fulfillmentScope: "PLATFORM_QC" });
    assert.equal(accepted.statusCode, 200);
    assert.equal(updateManyFilter.ownerType, "PLATFORM");
    assert.equal(updateManyFilter.productType, "QUICK_COMMERCE");
    assert.equal(updateManyFilter.sellerStatus, "Pending");
    assert.equal(updateManyUpdate.$set.sellerStatus, "Accepted");
    assert.equal(recomputeCalls, 1);

    (OrderItem.find as any) = async () => (pending ? [platformQcItem] : []);
    (OrderItem.findOneAndUpdate as any) = async (filter: any, update: any) => {
      assert.equal(filter.sellerStatus, "Pending");
      assert.equal(update.$set.sellerStatus, "Rejected");
      if (!pending) return null;
      pending = false;
      return platformQcItem;
    };
    (OrderItem.updateOne as any) = async () => ({ modifiedCount: 1 });
    (inventoryService as any).recordReturn = async (...args: any[]) => {
      returnCalls += 1;
      assert.equal(args[0], "platform-product");
      assert.equal(args[2], 3);
      assert.equal(args[3], "order-mixed-1");
      assert.equal(args[4], "platform-qc-item");
      return { success: true, previousStock: 7, newStock: 10, transactionId: "return-1" };
    };

    const rejected = await invoke({ status: "Rejected", fulfillmentScope: "PLATFORM_QC" });
    assert.equal(rejected.statusCode, 200);
    const repeated = await invoke({ status: "Rejected", fulfillmentScope: "PLATFORM_QC" });
    assert.equal(repeated.statusCode, 200);
    assert.equal(returnCalls, 1, "Repeated rejection must restore Platform QC stock exactly once");
    assert.equal(recomputeCalls, 3);

    assert.equal(updateManyFilter.ownerType, "PLATFORM");
    assert.equal(updateManyFilter.productType, "QUICK_COMMERCE");

    console.log("PASS: Platform QC acceptance targets only pending Platform QC items");
    console.log("PASS: Platform QC rejection atomically claims only pending Platform QC items");
    console.log("PASS: repeated rejection restores stock exactly once");
    console.log("PASS: Vendor and Platform Ecommerce items are outside the mutation filter");
  } finally {
    (Order.findById as any) = originals.orderFindById;
    (OrderItem.updateMany as any) = originals.itemUpdateMany;
    (OrderItem.find as any) = originals.itemFind;
    (OrderItem.findOneAndUpdate as any) = originals.itemFindOneAndUpdate;
    (OrderItem.updateOne as any) = originals.itemUpdateOne;
    (inventoryService as any).recordReturn = originals.recordReturn;
    (fulfillmentService as any).recomputeOrderFulfillment = originals.recompute;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
