export type ResourceFieldType = 'text' | 'password' | 'textarea' | 'number' | 'select' | 'multi-select' | 'switch';
export type ResourceMode = 'create' | 'edit';
export type ResourceTagType = 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface ResourceOption {
  label: string;
  value: string | number;
}

export interface ResourceColumn {
  prop: string;
  label: string;
  width?: number;
  minWidth?: number;
  formatter?: (row: any) => string;
  tag?: (row: any) => { text: string; type?: ResourceTagType };
}

export interface ResourceField {
  prop: string;
  label: string;
  type?: ResourceFieldType;
  required?: boolean;
  requiredOnCreate?: boolean;
  requiredOnEdit?: boolean;
  placeholder?: string;
  options?: ResourceOption[];
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
  fullWidth?: boolean;
  disabledOnEdit?: boolean;
  activeText?: string;
  inactiveText?: string;
  valueFromRow?: (row: any) => unknown;
}
