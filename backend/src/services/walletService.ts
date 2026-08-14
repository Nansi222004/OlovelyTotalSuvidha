import Seller from "../models/Seller";
import Customer from "../models/Customer";
import Commission from "../models/Commission";


/**
 * Process seller commission payment
 */
export const processSellerCommission = async (
  sellerId: string,
  commissionId: string
) => {
  const commission = await Commission.findById(commissionId);
  if (!commission || !commission.seller || commission.seller.toString() !== sellerId) {
    throw new Error("Commission not found or does not belong to seller");
  }

  if (commission.status !== "Pending") {
    throw new Error("Commission already processed");
  }

  const seller = await Seller.findById(sellerId);
  if (!seller) {
    throw new Error("Seller not found");
  }

  // Add commission to seller balance
  seller.balance += commission.commissionAmount;
  await seller.save();

  // Update commission status
  commission.status = "Paid";
  commission.paidAt = new Date();
  await commission.save();

  return {
    seller,
    commission,
  };
};

/**
 * Process withdrawal request
 */
export const processWithdrawal = async (
  sellerId: string,
  amount: number,
  paymentReference?: string
) => {
  const seller = await Seller.findById(sellerId);
  if (!seller) {
    throw new Error("Seller not found");
  }

  if (seller.balance < amount) {
    throw new Error("Insufficient balance");
  }

  // Deduct from seller balance
  seller.balance -= amount;
  await seller.save();

  // Mark pending commissions as paid (if withdrawal covers them)
  const pendingCommissions = await Commission.find({
    seller: sellerId,
    status: "Pending",
  }).sort({ createdAt: 1 });

  let remainingAmount = amount;
  for (const commission of pendingCommissions) {
    if (remainingAmount >= commission.commissionAmount) {
      commission.status = "Paid";
      commission.paidAt = new Date();
      commission.paymentReference = paymentReference;
      await commission.save();
      remainingAmount -= commission.commissionAmount;
    } else {
      break;
    }
  }

  return {
    seller,
    withdrawalAmount: amount,
    paymentReference,
  };
};

/**
 * Calculate seller earnings
 */
export const calculateSellerEarnings = async (
  sellerId: string,
  period?: { start: Date; end: Date }
) => {
  const query: any = { seller: sellerId, status: "Paid" };

  if (period) {
    query.paidAt = {
      $gte: period.start,
      $lte: period.end,
    };
  }

  const commissions = await Commission.find(query);

  const totalEarnings = commissions.reduce(
    (sum, c) => sum + c.commissionAmount,
    0
  );
  const totalOrders = commissions.length;

  return {
    totalEarnings,
    totalOrders,
    commissions,
  };
};

/**
 * Process customer wallet transaction
 */
export const processCustomerWalletTransaction = async (
  customerId: string,
  amount: number,
  type: "credit" | "debit",
  reason: string
) => {
  const customer = await Customer.findById(customerId);
  if (!customer) {
    throw new Error("Customer not found");
  }

  if (type === "debit" && customer.walletAmount < amount) {
    throw new Error("Insufficient wallet balance");
  }

  const previousBalance = customer.walletAmount;
  customer.walletAmount =
    type === "credit"
      ? customer.walletAmount + amount
      : customer.walletAmount - amount;

  await customer.save();

  return {
    customer,
    transaction: {
      type,
      amount,
      reason,
      previousBalance,
      newBalance: customer.walletAmount,
    },
  };
};

/**
 * Process fund transfer between accounts
 */
export const processFundTransfer = async (
  fromType: "seller" | "customer",
  fromId: string,
  toType: "seller" | "customer",
  toId: string,
  amount: number
) => {
  // Get from account
  let fromAccount: any;
  if (fromType === "seller") {
    fromAccount = await Seller.findById(fromId);
  } else {
    fromAccount = await Customer.findById(fromId);
  }

  if (!fromAccount) {
    throw new Error("From account not found");
  }

  const fromBalanceField = fromType === "seller" ? "balance" : "walletAmount";
  if (fromAccount[fromBalanceField] < amount) {
    throw new Error("Insufficient balance");
  }

  // Get to account
  let toAccount: any;
  if (toType === "seller") {
    toAccount = await Seller.findById(toId);
  } else {
    toAccount = await Customer.findById(toId);
  }

  if (!toAccount) {
    throw new Error("To account not found");
  }

  // Process transfer
  fromAccount[fromBalanceField] -= amount;
  const toBalanceField = toType === "seller" ? "balance" : "walletAmount";
  toAccount[toBalanceField] += amount;

  await Promise.all([fromAccount.save(), toAccount.save()]);

  return {
    from: {
      type: fromType,
      id: fromId,
      previousBalance: fromAccount[fromBalanceField] + amount,
      newBalance: fromAccount[fromBalanceField],
    },
    to: {
      type: toType,
      id: toId,
      previousBalance: toAccount[toBalanceField] - amount,
      newBalance: toAccount[toBalanceField],
    },
    amount,
  };
};
