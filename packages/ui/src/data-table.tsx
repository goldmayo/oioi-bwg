"use client";

import { Body, Cell, Footer, Head, Header, Row, Table } from "./data-table/structure";
import { Root } from "./data-table/context";
import {
  Columns,
  ColumnVisibility,
  ColumnOrder,
  ColumnPin,
  ColumnWidth,
  ExpandRow,
  Filter,
  Grouping,
  Pagination,
  RowPin,
  RowSelect,
  Search,
  Selection,
  Toolbar,
} from "./data-table/controls";

export type { DataTableColumnMeta } from "./data-table/context";

// 기능/행 모델/상태는 소비처의 공식 TanStack table이 소유한다.
export const DataTable = {
  Root,
  Table,
  Header,
  Head,
  Body,
  Row,
  Cell,
  Footer,
  Toolbar,
  Search,
  Filter,
  Grouping,
  Selection,
  Columns,
  ColumnVisibility,
  ColumnOrder,
  ColumnPin,
  ColumnWidth,
  Pagination,
  RowSelect,
  RowPin,
  ExpandRow,
};
