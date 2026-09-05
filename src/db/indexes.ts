import { FIELD_SCOPE, type FieldCollection } from './collections';

export type ValueIndexSpec = {
  collection: FieldCollection;
  name: string;
  properties: string[];
};

export type FtsIndexSpec = {
  collection: FieldCollection;
  name: string;
  properties: string[];
};

export const VALUE_INDEXES: ValueIndexSpec[] = [
  { collection: 'workordersin', name: 'idx_woin_today', properties: ['assignedTo.employeeId', 'scheduled.day', 'scheduled.startDt'] },
  { collection: 'workordersin', name: 'idx_woin_number', properties: ['number'] },
  { collection: 'workordersin', name: 'idx_woin_customer', properties: ['customerId'] },
  { collection: 'workordersout', name: 'idx_woout_source', properties: ['assignedTo.employeeId', 'source.id', 'role'] },
  { collection: 'workordersout', name: 'idx_woout_today', properties: ['assignedTo.employeeId', 'status'] },
  { collection: 'workordersout', name: 'idx_woout_amends', properties: ['amends.id'] },
  { collection: 'workordersout', name: 'idx_woout_sync', properties: ['syncState'] },
  { collection: 'assets', name: 'idx_ast_geo', properties: ['geo.lat', 'geo.lon'] },
  { collection: 'assets', name: 'idx_ast_type', properties: ['assetType'] },
  { collection: 'products', name: 'idx_prd_sku', properties: ['sku'] },
  { collection: 'inventory', name: 'idx_inv_loc_prd', properties: ['type', 'locationId', 'productId'] },
  { collection: 'inventory', name: 'idx_invtx_wo', properties: ['workOrderOutId'] },
  { collection: 'inventory', name: 'idx_invtx_loc_prd_dt', properties: ['type', 'locationId', 'productId', 'audit.cr.dt'] },
  { collection: 'users', name: 'idx_usr_employee', properties: ['employeeId'] },
  { collection: 'users', name: 'idx_usr_email', properties: ['email'] },
  { collection: 'users', name: 'idx_usr_username', properties: ['username'] },
  { collection: 'customers', name: 'idx_cus_name', properties: ['name'] },
  { collection: 'customers', name: 'idx_cus_account', properties: ['accountNumber'] },
  { collection: 'customers', name: 'idx_cus_origin', properties: ['origin'] },
  { collection: 'tasks', name: 'idx_tsk_wo', properties: ['workOrderOutId', 'status'] },
  { collection: 'tasks', name: 'idx_tsk_type', properties: ['type'] },
  { collection: 'notes', name: 'idx_nte_wo', properties: ['workOrderOutId', 'audit.cr.dt'] },
  { collection: 'messages', name: 'idx_msg_thread', properties: ['threadId', 'audit.cr.dt'] },
  { collection: 'messages', name: 'idx_msg_wo', properties: ['workOrderInId', 'audit.cr.dt'] },
  { collection: 'orders', name: 'idx_ord_today', properties: ['assignedTo.employeeId', 'role', 'scheduled.day', 'scheduled.startDt'] },
  { collection: 'orders', name: 'idx_ord_source', properties: ['assignedTo.employeeId', 'source.id', 'role'] },
  { collection: 'orders', name: 'idx_ord_sync', properties: ['syncState', 'role'] },
  { collection: 'rates', name: 'idx_rate_code', properties: ['code'] },
  { collection: 'taxes', name: 'idx_tax_code', properties: ['code'] },
];

export const FTS_INDEXES: FtsIndexSpec[] = [
  { collection: 'products', name: 'idx_prd_fts', properties: ['name', 'sku', 'description'] },
  { collection: 'assets', name: 'idx_ast_fts', properties: ['name', 'code', 'assetType'] },
  { collection: 'notes', name: 'idx_nte_fts', properties: ['body', 'title'] },
];

export { FIELD_SCOPE };
