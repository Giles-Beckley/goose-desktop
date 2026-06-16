/**
 * Hardcoded MCP tool and resource names from the GGM Commerce plugin.
 * Since we control both the plugin and the desktop app, we can reference
 * these directly instead of discovering them at runtime.
 *
 * These names are for the desktop app's OWN direct `tools/call` usage
 * (see mcpClient.ts). They remain individually callable by name on the
 * plugin regardless of the AI/dispatcher surface. The AI assistant does
 * NOT use these constants — it reaches the same operations through the
 * dispatcher tools (store_query / store_action) via discovery; see
 * systemPrompt.ts. Verified in sync with the live plugin: 110 tools.
 */

// ── Tools (executable actions) ──────────────────────────────────────────

export const MCP_TOOLS = {
  // Store settings (currency, etc.) — general domain, readable by any key.
  GET_STORE_SETTINGS: 'get_store_settings',

  // Dispatcher tools — reach any operation by name (get_quantity_discounts /
  // update_quantity_discounts etc.) via the plugin's progressive-disclosure
  // dispatcher. See .claude/PLUGIN_DISPATCHER_BRIEF.md.
  STORE_QUERY: 'store_query',
  STORE_ACTION: 'store_action',

  // Product search & filtering
  SEARCH_PRODUCTS: 'search_products',
  FIND_PRODUCT_BY_SKU: 'find_product_by_sku',
  CHECK_PRODUCT_AVAILABILITY: 'check_product_availability',
  GET_PRODUCT_RECOMMENDATIONS: 'get_product_recommendations',
  LIST_PRODUCT_TYPES: 'list_product_types',

  // Product management (CRUD)
  CREATE_PRODUCT: 'create_product',
  UPDATE_PRODUCT: 'update_product',
  DELETE_PRODUCT: 'delete_product',
  DUPLICATE_PRODUCT: 'duplicate_product',
  SET_PRODUCT_FEATURED: 'set_product_featured',
  ASSIGN_PRODUCT_CATEGORIES: 'assign_product_categories',
  ASSIGN_PRODUCT_TAGS: 'assign_product_tags',

  // Inventory
  UPDATE_PRODUCT_STOCK: 'update_product_stock',
  ADJUST_PRODUCT_STOCK: 'adjust_product_stock',
  UPDATE_PRODUCT_PRICE: 'update_product_price',
  BULK_UPDATE_STOCK: 'bulk_update_stock',
  SET_LOW_STOCK_THRESHOLD: 'set_low_stock_threshold',

  // Orders
  CREATE_ORDER: 'create_order',
  UPDATE_ORDER_STATUS: 'update_order_status',
  CANCEL_ORDER: 'cancel_order',
  GENERATE_ORDER_INVOICE: 'generate_order_invoice',

  // Customers
  LIST_CUSTOMERS: 'list_customers',
  GET_CUSTOMER: 'get_customer',
  CREATE_CUSTOMER: 'create_customer',
  UPDATE_CUSTOMER: 'update_customer',
  GET_CUSTOMER_ORDERS: 'get_customer_orders',
  ADD_CUSTOMER_ADDRESS: 'add_customer_address',
  UPDATE_CUSTOMER_ADDRESS: 'update_customer_address',
  DELETE_CUSTOMER_ADDRESS: 'delete_customer_address',

  // Categories & Tags
  LIST_CATEGORIES: 'list_categories',
  GET_CATEGORY: 'get_category',
  CREATE_CATEGORY: 'create_category',
  UPDATE_CATEGORY: 'update_category',
  DELETE_CATEGORY: 'delete_category',
  LIST_TAGS: 'list_tags',
  CREATE_TAG: 'create_tag',
  UPDATE_TAG: 'update_tag',
  DELETE_TAG: 'delete_tag',

  // Attributes
  LIST_ATTRIBUTE_GROUPS: 'list_attribute_groups',
  CREATE_ATTRIBUTE_GROUP: 'create_attribute_group',
  LIST_ATTRIBUTES: 'list_attributes',
  CREATE_ATTRIBUTE: 'create_attribute',
  SET_PRODUCT_ATTRIBUTES: 'set_product_attributes',
  GET_PRODUCT_ATTRIBUTES: 'get_product_attributes',
  ADD_GROUP_ATTRIBUTES_TO_PRODUCT: 'add_group_attributes_to_product',

  // Variations
  LIST_VARIATION_ATTRIBUTES: 'list_variation_attributes',
  CREATE_VARIATION_ATTRIBUTE: 'create_variation_attribute',
  UPDATE_VARIATION_ATTRIBUTE: 'update_variation_attribute',
  DELETE_VARIATION_ATTRIBUTE: 'delete_variation_attribute',
  GET_PRODUCT_VARIATIONS: 'get_product_variations',
  CONFIGURE_PRODUCT_VARIATIONS: 'configure_product_variations',
  CREATE_PRODUCT_VARIATION: 'create_product_variation',
  UPDATE_PRODUCT_VARIATION: 'update_product_variation',
  DELETE_PRODUCT_VARIATION: 'delete_product_variation',
  BULK_UPDATE_VARIATION_PRICES: 'bulk_update_variation_prices',
  GENERATE_PRODUCT_VARIATIONS: 'generate_product_variations',

  // Reviews
  LIST_REVIEWS: 'list_reviews',
  GET_REVIEW: 'get_review',
  GET_PRODUCT_REVIEWS: 'get_product_reviews',
  APPROVE_REVIEW: 'approve_review',
  REJECT_REVIEW: 'reject_review',
  DELETE_REVIEW: 'delete_review',
  UPDATE_REVIEW: 'update_review',
  GET_PENDING_REVIEWS_COUNT: 'get_pending_reviews_count',
  BULK_APPROVE_REVIEWS: 'bulk_approve_reviews',

  // Discounts & Vouchers
  CREATE_DISCOUNT: 'create_discount',
  UPDATE_DISCOUNT: 'update_discount',
  DELETE_DISCOUNT: 'delete_discount',
  VALIDATE_DISCOUNT_CODE: 'validate_discount_code',
  GET_VOUCHER_BALANCE: 'get_voucher_balance',
  BULK_GENERATE_VOUCHERS: 'bulk_generate_vouchers',
  GENERATE_GIFT_CARD_VOUCHER: 'generate_gift_card_voucher',

  // Cart
  ADD_TO_CART: 'add_to_cart',
  GET_CART_CONTENTS: 'get_cart_contents',
  UPDATE_CART_ITEM: 'update_cart_item',
  REMOVE_FROM_CART: 'remove_from_cart',
  CLEAR_CART: 'clear_cart',

  // Media
  UPLOAD_IMAGE_FROM_URL: 'upload_image_from_url',
  SET_PRODUCT_IMAGE: 'set_product_image',
  ADD_PRODUCT_GALLERY_IMAGE: 'add_product_gallery_image',
  LIST_MEDIA_IMAGES: 'list_media_images',
  UPLOAD_IMAGE_BASE64: 'upload_image_base64',
  UPLOAD_FILE_BASE64: 'upload_file_base64',

  // Shipments
  LIST_CARRIERS: 'list_carriers',
  LIST_SHIPMENT_STATUSES: 'list_shipment_statuses',
  CREATE_SHIPMENT: 'create_shipment',
  GET_SHIPMENT: 'get_shipment',
  GET_ORDER_SHIPMENTS: 'get_order_shipments',
  UPDATE_SHIPMENT_TRACKING: 'update_shipment_tracking',
  UPDATE_SHIPMENT_STATUS: 'update_shipment_status',
  MARK_SHIPMENT_SHIPPED: 'mark_shipment_shipped',
  MARK_SHIPMENT_DELIVERED: 'mark_shipment_delivered',
  LIST_PENDING_SHIPMENTS: 'list_pending_shipments',
  DELETE_SHIPMENT: 'delete_shipment',

  // Export
  EXPORT_TRANSACTIONS: 'export_transactions',
  REGENERATE_EXPORT: 'regenerate_export',
  DOWNLOAD_EXPORT: 'download_export',
  MARK_ORDERS_UNEXPORTED: 'mark_orders_unexported',
  GET_UNEXPORTED_ORDERS_PREVIEW: 'get_unexported_orders_preview',

  // Documents
  GET_PRODUCT_DOCUMENTS: 'get_product_documents',
  ADD_PRODUCT_DOCUMENT: 'add_product_document',
  DELETE_PRODUCT_DOCUMENT: 'delete_product_document',

  // Locations / Outlets (premium component: 'locations')
  CREATE_OUTLET: 'create_outlet',
  UPDATE_OUTLET: 'update_outlet',
  DELETE_OUTLET: 'delete_outlet',
  LIST_OUTLETS: 'list_outlets',
  GET_OUTLET: 'get_outlet',
  ATTACH_OUTLET_TO_PRODUCT: 'attach_outlet_to_product',
  DETACH_OUTLET_FROM_PRODUCT: 'detach_outlet_from_product',
  LIST_PRODUCT_OUTLETS: 'list_product_outlets',
  SEARCH_OUTLETS_NEAR: 'search_outlets_near',
  SEARCH_LISTINGS_NEAR: 'search_listings_near',
} as const;

// ── Resources (read-only data) ──────────────────────────────────────────

export const MCP_RESOURCES = {
  // Products
  PRODUCT_CATALOG: 'product://catalog',
  PRODUCT_BY_ID: 'product://{id}',
  PRODUCT_CATEGORIES: 'product://categories',
  PRODUCTS_BY_CATEGORY: 'product://category/{category_id}',
  PRODUCT_TAGS: 'product://tags',
  PRODUCTS_BY_TAG: 'product://tag/{tag_id}',
  PRODUCT_INVENTORY: 'product://inventory',
  PRODUCT_LOW_STOCK: 'product://inventory/low-stock',

  // Orders
  ORDER_LIST: 'order://list',
  ORDER_BY_ID: 'order://{order_id}',
  ORDERS_BY_STATUS: 'order://status/{status}',
  ORDERS_BY_CUSTOMER: 'order://customer/{email}',
  ORDER_RECENT: 'order://recent',
  ORDER_STATISTICS: 'order://statistics',

  // Customers
  CUSTOMER_LIST: 'customer://list',
  CUSTOMER_BY_EMAIL: 'customer://{email}',
  CUSTOMER_ADDRESSES: 'customer://{email}/addresses',
  CUSTOMER_STATISTICS: 'customer://statistics',

  // Exports
  EXPORT_BATCHES: 'export_batches',
  EXPORT_BATCH_BY_ID: 'export_batch://{id}',
  EXPORT_STATISTICS: 'export_statistics',
  UNEXPORTED_ORDERS: 'unexported_orders',

  // Discounts & Vouchers
  DISCOUNTS: 'discounts',
  DISCOUNT_BY_ID: 'discount://{id}',
  DISCOUNT_BY_CODE: 'discount_code://{code}',
  DISCOUNT_USAGE: 'discount_usage://{id}',
  VOUCHER_BALANCE: 'voucher_balance://{code}',
  ACTIVE_DISCOUNTS: 'active_discounts',
  DISCOUNT_STATISTICS: 'discount_statistics',
  GIFT_CARD_PRODUCTS: 'gift_card_products',
} as const;
