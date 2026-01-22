// Condition describes a path + regex that must match before updating.
export type Condition = {
  attribute: string;
  pattern: string;
};

// BatchOperation describes a single update rule.
export type BatchOperation = {
  attribute: string;
  pattern?: string;
  replacement?: string;
  condition?: Condition;
};

// UpdateResult summarizes whether any changes were applied and logs per operation.
export type UpdateResult = {
  updated: boolean;
  log: string[];
};
