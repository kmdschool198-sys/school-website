// Student savings (Firestore log_saving). A deposit record has no type (older records) or
// type 'deposit'; a withdrawal is its own record with type 'withdraw' and a positive amount.
// The balance is deposits minus withdrawals.
export interface SavingRecordLike {
  amount?: number | string;
  type?: string;
}

export const isWithdrawal = (l: SavingRecordLike) => l.type === 'withdraw';

/** Deposit amount (0 for a withdrawal). */
export const depositAmount = (l: SavingRecordLike) => (isWithdrawal(l) ? 0 : Number(l.amount) || 0);

/** Withdrawn amount (0 for a deposit). */
export const withdrawalAmount = (l: SavingRecordLike) => (isWithdrawal(l) ? Number(l.amount) || 0 : 0);

/** Effect on the balance: + for a deposit, - for a withdrawal. */
export const signedAmount = (l: SavingRecordLike) => depositAmount(l) - withdrawalAmount(l);
