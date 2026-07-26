export const datasetConfig = {
  currencySymbol: "\u20B9",
  fieldMap: {
    date: "date",
    region: "region",
    product: "product",
    category: "category",
    customerType: "customer_type",
    revenue: "revenue",
    profit: "profit",
    units: "units_sold"
  },
  fieldAliases: {
    date: ["order_date", "day", "timestamp", "created_at"],
    region: ["country", "market", "location", "territory", "geo"],
    product: ["product_name", "item", "item_name", "sku", "title"],
    category: ["segment", "department", "type", "group"],
    customerType: ["customerType", "customer_segment", "segment_name"],
    revenue: ["sales", "amount", "total_sales", "gmv", "income", "turnover"],
    profit: ["margin", "gross_profit", "net_profit", "earnings"],
    units: ["units_sold", "units", "quantity", "qty", "volume", "count"]
  },
  metricLabels: {
    revenue: "Revenue",
    profit: "Profit",
    units: "Units Sold"
  },
  dimensionLabels: {
    date: "Date",
    region: "Region",
    product: "Product",
    category: "Category",
    customerType: "Customer Type"
  },
  customerSegments: {
    new: ["new"],
    returning: ["returning", "repeat", "existing"]
  }
};