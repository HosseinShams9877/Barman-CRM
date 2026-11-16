export type FinanceCheque = {
  id: string;
  documentId: string;
  party: string;
  owner: string;
  bank: string;
  sayad: string;
  due: string;
  status: string;
  amount?: number;
};
