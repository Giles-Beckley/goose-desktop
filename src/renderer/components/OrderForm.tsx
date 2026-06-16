import { useState, useEffect } from 'react';
import { useMcp } from '../hooks/useMcp';
import { useConnectionStore } from '../stores/connectionStore';
import { formatCurrency } from '../../shared/currency';
import { MCP_TOOLS } from '../../shared/mcpTools';
import { LoadingSpinner } from './LoadingSpinner';
import type { Order, Product, Shipment, Customer } from '../../shared/types';

interface OrderFormProps {
  order?: Order | null;
  onClose: () => void;
  onSaved: () => void;
  /** View-only mode for read-access keys: disables all write actions. */
  readOnly?: boolean;
}

interface LineItem {
  product_id: number;
  product_name: string;
  quantity: number;
  /** Unit price from the product catalogue. Used as the default and shown
   *  as the placeholder; the store recalculates from this product unless an
   *  override is supplied. */
  price: number;
  /** Admin unit-price override (empty string = no override). Sent to the
   *  plugin as `price_override` on the line item. */
  priceOverride: string;
}

/** Minimal shape of a customer's saved address from get_customer. */
interface CustomerAddress {
  address_type: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

const ORDER_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PAYMENT_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'paid', label: 'Paid' },
  { value: 'failed', label: 'Failed' },
  { value: 'refunded', label: 'Refunded' },
];

const CARRIERS = [
  'royal_mail', 'dpd', 'dhl', 'ups', 'fedex', 'evri', 'yodel', 'parcelforce', 'usps', 'other',
];

const SHIPMENT_STATUSES = [
  'pending', 'label_created', 'shipped', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned', 'cancelled',
];

export function OrderForm({ order, onClose, onSaved, readOnly = false }: OrderFormProps) {
  const { callTool } = useMcp();
  const currency = useConnectionStore((s) => s.currency);
  const money = (amount: number | null | undefined) => formatCurrency(amount, currency);
  const isView = !!order;

  // Customer fields (create mode)
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');

  // Customer picker (create mode) — search existing, fall back to manual entry.
  // When a customer is selected we bind to them and lock the manual fields;
  // "Enter new customer" clears the binding and re-enables manual input.
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [customerSearchMsg, setCustomerSearchMsg] = useState<string | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);

  // Billing address (create mode)
  const [billingAddress1, setBillingAddress1] = useState('');
  const [billingAddress2, setBillingAddress2] = useState('');
  const [billingCity, setBillingCity] = useState('');
  const [billingState, setBillingState] = useState('');
  const [billingPostcode, setBillingPostcode] = useState('');
  const [billingCountry, setBillingCountry] = useState('');

  // Shipping address (create mode). When `shipSameAsBilling` is true the
  // shipping_* fields are omitted and the store falls back to billing.
  const [shipSameAsBilling, setShipSameAsBilling] = useState(true);
  const [shippingAddress1, setShippingAddress1] = useState('');
  const [shippingAddress2, setShippingAddress2] = useState('');
  const [shippingCity, setShippingCity] = useState('');
  const [shippingState, setShippingState] = useState('');
  const [shippingPostcode, setShippingPostcode] = useState('');
  const [shippingCountry, setShippingCountry] = useState('');

  // Tax (create mode). Tax is always computed server-side from the store's
  // rules; the only lever exposed here is the B2B tax-exemption path
  // (is_business + tax_id) honoured by GGM_Commerce_Orders::create_order().
  const [isBusiness, setIsBusiness] = useState(false);
  const [taxId, setTaxId] = useState('');

  // Order-level overrides (create mode). All optional; the plugin's
  // create_order honours them via its $options parameter. Empty => the store
  // calculates/defaults as normal.
  const [discountCode, setDiscountCode] = useState('');
  const [shippingAmount, setShippingAmount] = useState(''); // '' => store-calculated
  const [createStatus, setCreateStatus] = useState('pending');
  const [createPaymentStatus, setCreatePaymentStatus] = useState('pending');

  // Line items (create mode)
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [searchingProducts, setSearchingProducts] = useState(false);

  // Status update (view mode)
  const [newStatus, setNewStatus] = useState(order?.status ?? '');
  const [newPaymentStatus, setNewPaymentStatus] = useState(order?.payment_status ?? 'pending');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Shipments (view mode)
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(false);
  const [showAddShipment, setShowAddShipment] = useState(false);
  const [shipCarrier, setShipCarrier] = useState('royal_mail');
  const [shipTracking, setShipTracking] = useState('');
  const [shipTrackingUrl, setShipTrackingUrl] = useState('');
  const [shipWeight, setShipWeight] = useState('');
  const [shipCost, setShipCost] = useState('');
  const [shipNotes, setShipNotes] = useState('');

  // Tab for view mode
  const [viewTab, setViewTab] = useState<'details' | 'shipments'>('details');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isView && order) {
      loadShipments();
    }
  }, []);

  const loadShipments = async () => {
    if (!order) return;
    setLoadingShipments(true);
    try {
      const result = await callTool(MCP_TOOLS.GET_ORDER_SHIPMENTS, { order_id: order.id });
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        setShipments(Array.isArray(data) ? data : data.shipments ?? []);
      }
    } catch (err) {
      console.error('Failed to load shipments:', err);
    } finally {
      setLoadingShipments(false);
    }
  };

  const searchCustomers = async (term: string) => {
    setCustomerSearch(term);
    if (term.length < 2) {
      setCustomerResults([]);
      setCustomerSearchMsg(null);
      return;
    }
    setSearchingCustomers(true);
    setCustomerSearchMsg(null);
    try {
      // sort_by/sort_order are passed explicitly: the plugin's list_customers
      // builds an invalid `ORDER BY  DESC` when sort_by is omitted (returns 0
      // rows). Passing them sidesteps that until the plugin is fixed.
      const result = await callTool(MCP_TOOLS.LIST_CUSTOMERS, { search: term, limit: 10, sort_by: 'created_at', sort_order: 'desc' });
      // callTool swallows errors and returns null (logged to the console). Treat
      // that as a lookup failure rather than silently showing nothing.
      if (result === null) {
        setCustomerResults([]);
        setCustomerSearchMsg('Customer lookup failed — your API key may not have read access to customers. You can still enter details manually.');
        return;
      }
      const text = result?.content?.[0]?.text;
      const data = text ? JSON.parse(text) : null;
      // The plugin returns { success, error?, customers: [...] }.
      if (data && data.success === false) {
        setCustomerResults([]);
        setCustomerSearchMsg(data.error || 'Customer lookup failed.');
        return;
      }
      const items = Array.isArray(data) ? data : data?.customers ?? [];
      setCustomerResults(items as Customer[]);
      setCustomerSearchMsg(items.length === 0 ? 'No matching customers. Enter details below to create a new one.' : null);
    } catch (err) {
      setCustomerResults([]);
      setCustomerSearchMsg(err instanceof Error ? err.message : 'Customer lookup failed.');
    } finally {
      setSearchingCustomers(false);
    }
  };

  const selectCustomer = async (customer: Customer) => {
    setSelectedCustomerId(customer.id);
    setEmail(customer.email ?? '');
    setFirstName(customer.first_name ?? '');
    setLastName(customer.last_name ?? '');
    setPhone(customer.phone ?? '');
    setIsBusiness(customer.account_type === 'business' || !!customer.is_tax_exempt);
    setTaxId(customer.tax_id ?? '');
    setCustomerSearch('');
    setCustomerResults([]);
    setCustomerSearchMsg(null);

    // Pull saved addresses to prefill billing/shipping.
    try {
      const result = await callTool(MCP_TOOLS.GET_CUSTOMER, { customer_id: customer.id });
      const text = result?.content?.[0]?.text;
      if (text) {
        const data = JSON.parse(text);
        const addresses: CustomerAddress[] = data.customer?.addresses ?? [];
        const billing = addresses.find(a => a.address_type === 'billing') ?? addresses[0];
        const shipping = addresses.find(a => a.address_type === 'shipping');
        if (billing) applyBilling(billing);
        if (shipping) {
          setShipSameAsBilling(false);
          applyShipping(shipping);
        }
      }
    } catch {
      // Address prefill is best-effort; manual fields stay editable.
    }
  };

  const applyBilling = (a: CustomerAddress) => {
    setBillingAddress1(a.address_line_1 ?? '');
    setBillingAddress2(a.address_line_2 ?? '');
    setBillingCity(a.city ?? '');
    setBillingState(a.state ?? '');
    setBillingPostcode(a.postcode ?? '');
    setBillingCountry(a.country ?? '');
  };

  const applyShipping = (a: CustomerAddress) => {
    setShippingAddress1(a.address_line_1 ?? '');
    setShippingAddress2(a.address_line_2 ?? '');
    setShippingCity(a.city ?? '');
    setShippingState(a.state ?? '');
    setShippingPostcode(a.postcode ?? '');
    setShippingCountry(a.country ?? '');
  };

  const clearCustomer = () => {
    setSelectedCustomerId(null);
    setEmail('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setIsBusiness(false);
    setTaxId('');
  };

  const searchProducts = async (term: string) => {
    setProductSearch(term);
    if (term.length < 2) {
      setProductResults([]);
      return;
    }
    setSearchingProducts(true);
    try {
      const result = await callTool(MCP_TOOLS.SEARCH_PRODUCTS, { search_term: term, limit: 10 });
      if (result) {
        const text = result.content?.[0]?.text;
        if (text) {
          const data = JSON.parse(text);
          setProductResults(Array.isArray(data) ? data : data.products ?? []);
        }
      }
    } catch {
      setProductResults([]);
    } finally {
      setSearchingProducts(false);
    }
  };

  const addLineItem = (product: Product) => {
    const existing = lineItems.find(li => li.product_id === product.id);
    if (existing) {
      setLineItems(lineItems.map(li =>
        li.product_id === product.id ? { ...li, quantity: li.quantity + 1 } : li
      ));
    } else {
      const price = parseFloat(product.sale_price || product.price) || 0;
      setLineItems([...lineItems, { product_id: product.id, product_name: product.name, quantity: 1, price, priceOverride: '' }]);
    }
    setProductSearch('');
    setProductResults([]);
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity < 1) {
      setLineItems(lineItems.filter(li => li.product_id !== productId));
    } else {
      setLineItems(lineItems.map(li =>
        li.product_id === productId ? { ...li, quantity } : li
      ));
    }
  };

  const updatePriceOverride = (productId: number, value: string) => {
    setLineItems(lineItems.map(li =>
      li.product_id === productId ? { ...li, priceOverride: value } : li
    ));
  };

  const removeLineItem = (productId: number) => {
    setLineItems(lineItems.filter(li => li.product_id !== productId));
  };

  /** Effective unit price for a line: override if a valid one is set, else
   *  the catalogue price. Used for the subtotal preview. */
  const effectivePrice = (li: LineItem): number => {
    const o = parseFloat(li.priceOverride);
    return li.priceOverride.trim() !== '' && !isNaN(o) && o >= 0 ? o : li.price;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !firstName.trim() || !lastName.trim() || lineItems.length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const customer: Record<string, string> = {
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      };
      if (phone.trim()) customer.phone = phone.trim();
      if (billingAddress1.trim()) customer.billing_address_1 = billingAddress1.trim();
      if (billingAddress2.trim()) customer.billing_address_2 = billingAddress2.trim();
      if (billingCity.trim()) customer.billing_city = billingCity.trim();
      if (billingState.trim()) customer.billing_state = billingState.trim();
      if (billingPostcode.trim()) customer.billing_postcode = billingPostcode.trim();
      if (billingCountry.trim()) customer.billing_country = billingCountry.trim();

      // Shipping address. When "same as billing" is on we omit shipping_*
      // entirely; the store falls back to the billing values on create.
      if (!shipSameAsBilling) {
        if (shippingAddress1.trim()) customer.shipping_address_1 = shippingAddress1.trim();
        if (shippingAddress2.trim()) customer.shipping_address_2 = shippingAddress2.trim();
        if (shippingCity.trim()) customer.shipping_city = shippingCity.trim();
        if (shippingState.trim()) customer.shipping_state = shippingState.trim();
        if (shippingPostcode.trim()) customer.shipping_postcode = shippingPostcode.trim();
        if (shippingCountry.trim()) customer.shipping_country = shippingCountry.trim();
      }

      // B2B tax exemption — the only tax lever create_order honours. Tax
      // itself is always computed server-side from the store's rules.
      if (isBusiness) {
        customer.is_business = 'true';
        if (taxId.trim()) customer.tax_id = taxId.trim();
      }

      const args: Record<string, unknown> = {
        customer,
        // product_id + quantity are required; price_override is optional and
        // only sent when the admin typed a valid non-negative figure.
        items: lineItems.map(li => {
          const item: Record<string, unknown> = { product_id: li.product_id, quantity: li.quantity };
          const override = parseFloat(li.priceOverride);
          if (li.priceOverride.trim() !== '' && !isNaN(override) && override >= 0) {
            item.price_override = override;
          }
          return item;
        }),
      };
      if (notes.trim()) args.notes = notes.trim();

      // Order-level overrides, honoured by create_order's $options. Each is
      // omitted unless explicitly set so the store keeps its defaults.
      if (discountCode.trim()) args.discount_code = discountCode.trim();
      const ship = parseFloat(shippingAmount);
      if (shippingAmount.trim() !== '' && !isNaN(ship) && ship >= 0) args.shipping_amount = ship;
      if (createStatus !== 'pending') args.status = createStatus;
      if (createPaymentStatus !== 'pending') args.payment_status = createPaymentStatus;

      await callTool(MCP_TOOLS.CREATE_ORDER, args);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!order) return;

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const args: Record<string, unknown> = { order_id: order.id };
      if (newStatus !== order.status) args.status = newStatus;
      if (newPaymentStatus !== (order.payment_status ?? 'pending')) args.payment_status = newPaymentStatus;

      if (Object.keys(args).length <= 1) return; // nothing changed

      await callTool(MCP_TOOLS.UPDATE_ORDER_STATUS, args);
      setSuccessMsg('Status updated');
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;

    setSaving(true);
    setError(null);

    try {
      const args: Record<string, unknown> = { order_id: order.id };
      if (cancelReason.trim()) args.reason = cancelReason.trim();

      await callTool(MCP_TOOLS.CANCEL_ORDER, args);
      setShowCancelConfirm(false);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel order');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!order) return;

    setSaving(true);
    setError(null);

    try {
      const result = await callTool(MCP_TOOLS.GENERATE_ORDER_INVOICE, { order_id: order.id });
      if (result?.content?.[0]?.text) {
        // Convert text invoice to downloadable file
        const text = result.content[0].text;
        const base64 = btoa(unescape(encodeURIComponent(text)));
        await window.electronAPI.dialog.saveFile(
          `invoice-${order.order_number ?? order.id}.txt`,
          base64
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invoice');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateShipment = async () => {
    if (!order) return;

    setSaving(true);
    setError(null);

    try {
      const args: Record<string, unknown> = {
        order_id: order.id,
        carrier: shipCarrier,
      };
      if (shipTracking.trim()) args.tracking_number = shipTracking.trim();
      if (shipTrackingUrl.trim()) args.tracking_url = shipTrackingUrl.trim();
      if (shipWeight) args.weight = parseFloat(shipWeight);
      if (shipCost) args.cost = parseFloat(shipCost);
      if (shipNotes.trim()) args.notes = shipNotes.trim();

      await callTool(MCP_TOOLS.CREATE_SHIPMENT, args);
      setShowAddShipment(false);
      setShipCarrier('royal_mail');
      setShipTracking('');
      setShipTrackingUrl('');
      setShipWeight('');
      setShipCost('');
      setShipNotes('');
      loadShipments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create shipment');
    } finally {
      setSaving(false);
    }
  };

  const handleShipmentStatusUpdate = async (shipmentId: number, status: string) => {
    setSaving(true);
    setError(null);

    try {
      if (status === 'shipped' || status === 'in_transit') {
        await callTool(MCP_TOOLS.MARK_SHIPMENT_SHIPPED, { shipment_id: shipmentId });
      } else if (status === 'delivered') {
        await callTool(MCP_TOOLS.MARK_SHIPMENT_DELIVERED, { shipment_id: shipmentId });
      } else {
        await callTool(MCP_TOOLS.UPDATE_SHIPMENT_STATUS, { shipment_id: shipmentId, status });
      }
      loadShipments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update shipment');
    } finally {
      setSaving(false);
    }
  };

  // ── View/Edit existing order ──
  if (isView && order) {
    return (
      <div className="flex flex-col h-full">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 mb-4">{error}</div>
        )}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-600 mb-4">{successMsg}</div>
        )}
        {readOnly && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-700 mb-4">
            Your API key has read-only access to orders. Changes are disabled.
          </div>
        )}

        <fieldset disabled={readOnly} className="contents">
        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-goose-border">
          <button
            type="button"
            onClick={() => setViewTab('details')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              viewTab === 'details'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-goose-text-light hover:text-goose-text'
            }`}
          >
            Order Details
          </button>
          <button
            type="button"
            onClick={() => setViewTab('shipments')}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              viewTab === 'shipments'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-goose-text-light hover:text-goose-text'
            }`}
          >
            Shipments {shipments.length > 0 && `(${shipments.length})`}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5">
          {viewTab === 'details' && (
            <>
              {/* Order summary */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-goose-text-light">Order</span>
                  <span className="text-sm font-medium text-goose-text">#{order.order_number ?? order.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-goose-text-light">Date</span>
                  <span className="text-sm text-goose-text">
                    {order.created_at ? new Date(order.created_at).toLocaleDateString() : '--'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-goose-text-light">Customer</span>
                  <span className="text-sm text-goose-text">
                    {order.customer_first_name ? `${order.customer_first_name} ${order.customer_last_name ?? ''}`.trim() : order.customer_email ?? 'Guest'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-goose-text-light">Email</span>
                  <span className="text-sm text-goose-text">{order.customer_email ?? '--'}</span>
                </div>
                {order.customer_phone && (
                  <div className="flex justify-between">
                    <span className="text-sm text-goose-text-light">Phone</span>
                    <span className="text-sm text-goose-text">{order.customer_phone}</span>
                  </div>
                )}
              </div>

              {/* Billing address */}
              {order.billing_address_1 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-xs font-medium text-goose-text-light uppercase mb-2">Billing Address</h3>
                  <div className="text-sm text-goose-text space-y-0.5">
                    <p>{order.billing_address_1}</p>
                    {order.billing_address_2 && <p>{order.billing_address_2}</p>}
                    <p>
                      {[order.billing_city, order.billing_state, order.billing_postcode].filter(Boolean).join(', ')}
                    </p>
                    {order.billing_country && <p>{order.billing_country}</p>}
                  </div>
                </div>
              )}

              {/* Price breakdown */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-1.5">
                <h3 className="text-xs font-medium text-goose-text-light uppercase mb-2">Totals</h3>
                {order.subtotal != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-goose-text-light">Subtotal</span>
                    <span className="text-goose-text">{money(order.subtotal)}</span>
                  </div>
                )}
                {(order.tax_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-goose-text-light">Tax</span>
                    <span className="text-goose-text">{money(order.tax_amount)}</span>
                  </div>
                )}
                {(order.shipping_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-goose-text-light">Shipping</span>
                    <span className="text-goose-text">{money(order.shipping_amount)}</span>
                  </div>
                )}
                {(order.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-goose-text-light">Discount</span>
                    <span className="text-green-600">-{money(order.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-medium pt-1.5 border-t border-goose-border">
                  <span className="text-goose-text">Total</span>
                  <span className="text-goose-text">{money(order.total_amount)}</span>
                </div>
              </div>

              {/* Line items */}
              {order.items && order.items.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-goose-text mb-2">Items</h3>
                  <div className="border border-goose-border rounded-lg divide-y divide-goose-border">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        {item.product_image && (
                          <img src={item.product_image} alt="" className="w-8 h-8 object-cover rounded" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-goose-text truncate">
                            {item.product_name ?? `Product #${item.product_id}`}
                          </p>
                          {item.product_sku && (
                            <p className="text-xs text-goose-text-light">{item.product_sku}</p>
                          )}
                        </div>
                        <span className="text-xs text-goose-text-light">x{item.quantity}</span>
                        <span className="text-sm font-medium text-goose-text">{money(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {order.notes && (
                <div>
                  <h3 className="text-sm font-medium text-goose-text mb-1">Notes</h3>
                  <p className="text-sm text-goose-text-light bg-gray-50 rounded-lg p-3">{order.notes}</p>
                </div>
              )}

              {/* Order status update */}
              <div className="pt-4 border-t border-goose-border space-y-3">
                <h3 className="text-sm font-medium text-goose-text">Update Status</h3>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Order status">
                    <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="input">
                      {ORDER_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Payment status">
                    <select value={newPaymentStatus} onChange={(e) => setNewPaymentStatus(e.target.value)} className="input">
                      {PAYMENT_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <button
                  onClick={handleStatusUpdate}
                  disabled={saving || (newStatus === order.status && newPaymentStatus === (order.payment_status ?? 'pending'))}
                  className="w-full px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <LoadingSpinner size="sm" />}
                  Update Status
                </button>
              </div>

              {/* Invoice */}
              <button
                onClick={handleGenerateInvoice}
                disabled={saving}
                className="w-full px-4 py-2 text-sm font-medium text-goose-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Invoice
              </button>

              {/* Cancel order */}
              {order.status !== 'cancelled' && order.status !== 'completed' && (
                <div className="pt-4 border-t border-goose-border">
                  {!showCancelConfirm ? (
                    <button
                      onClick={() => setShowCancelConfirm(true)}
                      disabled={saving}
                      className="w-full px-4 py-2.5 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      Cancel Order
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <Field label="Cancellation reason (optional)">
                        <textarea
                          value={cancelReason}
                          onChange={(e) => setCancelReason(e.target.value)}
                          className="input"
                          rows={2}
                          placeholder="Why is this order being cancelled?"
                        />
                      </Field>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancel}
                          disabled={saving}
                          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {saving && <LoadingSpinner size="sm" />}
                          Confirm Cancel
                        </button>
                        <button
                          onClick={() => setShowCancelConfirm(false)}
                          className="px-4 py-2 text-sm font-medium text-goose-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Back
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Shipments tab ── */}
          {viewTab === 'shipments' && (
            <>
              {loadingShipments ? (
                <div className="flex justify-center py-8"><LoadingSpinner /></div>
              ) : (
                <>
                  {shipments.length === 0 && !showAddShipment && (
                    <p className="text-sm text-goose-text-light text-center py-4">No shipments yet.</p>
                  )}

                  {shipments.map(ship => (
                    <div key={ship.id} className="border border-goose-border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-goose-text capitalize">{ship.carrier.replace('_', ' ')}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${shipmentStatusColor(ship.status)}`}>
                          {ship.status.replace('_', ' ')}
                        </span>
                      </div>
                      {ship.tracking_number && (
                        <div className="flex justify-between text-sm">
                          <span className="text-goose-text-light">Tracking</span>
                          {ship.tracking_url ? (
                            <button
                              onClick={() => window.electronAPI.shell.openExternal(ship.tracking_url!)}
                              className="text-primary-600 hover:underline"
                            >
                              {ship.tracking_number}
                            </button>
                          ) : (
                            <span className="text-goose-text">{ship.tracking_number}</span>
                          )}
                        </div>
                      )}
                      {ship.weight != null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-goose-text-light">Weight</span>
                          <span className="text-goose-text">{ship.weight} kg</span>
                        </div>
                      )}
                      {ship.cost != null && (
                        <div className="flex justify-between text-sm">
                          <span className="text-goose-text-light">Cost</span>
                          <span className="text-goose-text">{money(ship.cost)}</span>
                        </div>
                      )}
                      {ship.notes && (
                        <p className="text-xs text-goose-text-light">{ship.notes}</p>
                      )}

                      {/* Quick status actions */}
                      {ship.status !== 'delivered' && ship.status !== 'cancelled' && (
                        <div className="flex gap-2 pt-2">
                          <select
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) handleShipmentStatusUpdate(ship.id, e.target.value);
                              e.target.value = '';
                            }}
                            className="input text-xs flex-1"
                          >
                            <option value="" disabled>Change status...</option>
                            {SHIPMENT_STATUSES.filter(s => s !== ship.status).map(s => (
                              <option key={s} value={s}>{s.replace('_', ' ')}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add shipment form */}
                  {showAddShipment ? (
                    <div className="border border-goose-border rounded-lg p-4 space-y-3">
                      <h4 className="text-sm font-medium text-goose-text">New Shipment</h4>
                      <Field label="Carrier">
                        <select value={shipCarrier} onChange={(e) => setShipCarrier(e.target.value)} className="input">
                          {CARRIERS.map(c => (
                            <option key={c} value={c}>{c.replace('_', ' ')}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Tracking number">
                        <input type="text" value={shipTracking} onChange={(e) => setShipTracking(e.target.value)} className="input" />
                      </Field>
                      <Field label="Tracking URL">
                        <input type="url" value={shipTrackingUrl} onChange={(e) => setShipTrackingUrl(e.target.value)} className="input" placeholder="https://..." />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Weight (kg)">
                          <input type="number" step="0.01" min="0" value={shipWeight} onChange={(e) => setShipWeight(e.target.value)} className="input" />
                        </Field>
                        <Field label="Cost">
                          <input type="number" step="0.01" min="0" value={shipCost} onChange={(e) => setShipCost(e.target.value)} className="input" />
                        </Field>
                      </div>
                      <Field label="Notes">
                        <textarea value={shipNotes} onChange={(e) => setShipNotes(e.target.value)} className="input" rows={2} />
                      </Field>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCreateShipment}
                          disabled={saving}
                          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {saving && <LoadingSpinner size="sm" />}
                          Create Shipment
                        </button>
                        <button
                          onClick={() => setShowAddShipment(false)}
                          className="px-4 py-2 text-sm font-medium text-goose-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddShipment(true)}
                      className="w-full px-4 py-2 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Shipment
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
        </fieldset>
      </div>
    );
  }

  // ── Create new order ──
  return (
    <form onSubmit={handleCreate} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
      )}

      <h3 className="text-sm font-display font-semibold text-goose-text">Customer</h3>

      {/* Existing-customer picker. Selecting one binds the order to that
          customer and prefills (and locks) the manual fields below. */}
      {selectedCustomerId === null ? (
        <div className="relative">
          <input
            type="text"
            value={customerSearch}
            onChange={(e) => searchCustomers(e.target.value)}
            placeholder="Find existing customer by name, email, or phone..."
            className="input"
          />
          {searchingCustomers && (
            <div className="absolute right-3 top-2.5">
              <LoadingSpinner size="sm" />
            </div>
          )}
          {customerResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-goose-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {customerResults.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectCustomer(c)}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50"
                >
                  <span className="text-goose-text">{`${c.first_name} ${c.last_name}`.trim() || c.email}</span>
                  <span className="block text-xs text-goose-text-light">
                    {c.email}{c.total_orders ? ` · ${c.total_orders} orders` : ''}
                  </span>
                </button>
              ))}
            </div>
          )}
          {customerSearchMsg ? (
            <p className="mt-1 text-xs text-amber-700">{customerSearchMsg}</p>
          ) : (
            <p className="mt-1 text-xs text-goose-text-light">Or enter the customer details below to create a new one.</p>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-lg px-4 py-2.5">
          <div className="text-sm">
            <span className="font-medium text-goose-text">{`${firstName} ${lastName}`.trim() || email}</span>
            <span className="block text-xs text-goose-text-light">Existing customer · {email}</span>
          </div>
          <button
            type="button"
            onClick={clearCustomer}
            className="text-xs font-medium text-primary-700 hover:underline"
          >
            Enter new customer
          </button>
        </div>
      )}

      <Field label="Email *">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={selectedCustomerId !== null} className="input disabled:bg-gray-50 disabled:text-goose-text-light" placeholder="customer@example.com" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="First name *">
          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required disabled={selectedCustomerId !== null} className="input disabled:bg-gray-50 disabled:text-goose-text-light" />
        </Field>
        <Field label="Last name *">
          <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required disabled={selectedCustomerId !== null} className="input disabled:bg-gray-50 disabled:text-goose-text-light" />
        </Field>
      </div>

      <Field label="Phone">
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={selectedCustomerId !== null} className="input disabled:bg-gray-50 disabled:text-goose-text-light" />
      </Field>

      {/* Tax handling: store computes tax automatically. The only lever is
          B2B exemption (business customer + tax ID). */}
      <div className="rounded-lg border border-goose-border p-3 space-y-2">
        <label className="flex items-center gap-2 text-sm text-goose-text">
          <input type="checkbox" checked={isBusiness} onChange={(e) => setIsBusiness(e.target.checked)} className="rounded" />
          Business customer (B2B)
        </label>
        {isBusiness && (
          <Field label="Tax ID / VAT number">
            <input type="text" value={taxId} onChange={(e) => setTaxId(e.target.value)} className="input" placeholder="e.g. GB123456789" />
          </Field>
        )}
        <p className="text-xs text-goose-text-light">
          Tax is calculated automatically by the store on creation. A valid business tax ID may make the order tax-exempt.
        </p>
      </div>

      {/* Billing address */}
      <div className="pt-4 border-t border-goose-border">
        <h3 className="text-sm font-display font-semibold text-goose-text mb-3">Billing Address</h3>

        <div className="space-y-3">
          <Field label="Address line 1">
            <input type="text" value={billingAddress1} onChange={(e) => setBillingAddress1(e.target.value)} className="input" />
          </Field>
          <Field label="Address line 2">
            <input type="text" value={billingAddress2} onChange={(e) => setBillingAddress2(e.target.value)} className="input" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="City">
              <input type="text" value={billingCity} onChange={(e) => setBillingCity(e.target.value)} className="input" />
            </Field>
            <Field label="County / State">
              <input type="text" value={billingState} onChange={(e) => setBillingState(e.target.value)} className="input" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Postcode">
              <input type="text" value={billingPostcode} onChange={(e) => setBillingPostcode(e.target.value)} className="input" />
            </Field>
            <Field label="Country">
              <input type="text" value={billingCountry} onChange={(e) => setBillingCountry(e.target.value)} className="input" />
            </Field>
          </div>
        </div>
      </div>

      {/* Shipping address */}
      <div className="pt-4 border-t border-goose-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-display font-semibold text-goose-text">Shipping Address</h3>
          <label className="flex items-center gap-2 text-xs text-goose-text-light">
            <input type="checkbox" checked={shipSameAsBilling} onChange={(e) => setShipSameAsBilling(e.target.checked)} className="rounded" />
            Same as billing
          </label>
        </div>

        {!shipSameAsBilling && (
          <div className="space-y-3">
            <Field label="Address line 1">
              <input type="text" value={shippingAddress1} onChange={(e) => setShippingAddress1(e.target.value)} className="input" />
            </Field>
            <Field label="Address line 2">
              <input type="text" value={shippingAddress2} onChange={(e) => setShippingAddress2(e.target.value)} className="input" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="City">
                <input type="text" value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} className="input" />
              </Field>
              <Field label="County / State">
                <input type="text" value={shippingState} onChange={(e) => setShippingState(e.target.value)} className="input" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Postcode">
                <input type="text" value={shippingPostcode} onChange={(e) => setShippingPostcode(e.target.value)} className="input" />
              </Field>
              <Field label="Country">
                <input type="text" value={shippingCountry} onChange={(e) => setShippingCountry(e.target.value)} className="input" />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="pt-4 border-t border-goose-border">
        <h3 className="text-sm font-display font-semibold text-goose-text mb-3">Items</h3>

        {/* Product search */}
        <div className="relative mb-3">
          <input
            type="text"
            value={productSearch}
            onChange={(e) => searchProducts(e.target.value)}
            placeholder="Search products to add..."
            className="input"
          />
          {searchingProducts && (
            <div className="absolute right-3 top-2.5">
              <LoadingSpinner size="sm" />
            </div>
          )}

          {/* Search results dropdown */}
          {productResults.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border border-goose-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {productResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addLineItem(p)}
                  className="w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 flex justify-between items-center"
                >
                  <span className="text-goose-text">{p.name}</span>
                  <span className="text-goose-text-light">{money(parseFloat(p.sale_price || p.price) || 0)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Added items */}
        {lineItems.length > 0 ? (
          <div className="border border-goose-border rounded-lg divide-y divide-goose-border">
            {lineItems.map((li) => (
              <div key={li.product_id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <span className="block text-sm text-goose-text truncate">{li.product_name}</span>
                  <span className="text-xs text-goose-text-light">Catalogue: {money(li.price)} each</span>
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-1.5 text-xs text-goose-text-light">{currency.symbol}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={li.priceOverride}
                    onChange={(e) => updatePriceOverride(li.product_id, e.target.value)}
                    placeholder={li.price.toFixed(2)}
                    title="Unit price override (leave blank to use catalogue price)"
                    className="w-24 pl-5 pr-2 py-1 border border-goose-border rounded text-sm text-right"
                  />
                </div>
                <input
                  type="number"
                  min="1"
                  value={li.quantity}
                  onChange={(e) => updateQuantity(li.product_id, parseInt(e.target.value, 10) || 1)}
                  className="w-16 px-2 py-1 border border-goose-border rounded text-sm text-center"
                />
                <span className="w-20 text-right text-sm font-medium text-goose-text">{money(effectivePrice(li) * li.quantity)}</span>
                <button
                  type="button"
                  onClick={() => removeLineItem(li.product_id)}
                  className="p-1 text-goose-text-light hover:text-red-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
            <div className="flex justify-between px-4 py-2.5 bg-gray-50 text-sm">
              <span className="text-goose-text-light">Subtotal (before tax &amp; shipping)</span>
              <span className="font-medium text-goose-text">
                {money(lineItems.reduce((sum, li) => sum + effectivePrice(li) * li.quantity, 0))}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-goose-text-light text-center py-4">No items added yet. Search for products above.</p>
        )}
      </div>

      {/* Discount & shipping */}
      <div className="pt-4 border-t border-goose-border space-y-3">
        <h3 className="text-sm font-display font-semibold text-goose-text">Discount &amp; Shipping</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Discount code">
            <input
              type="text"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              className="input"
              placeholder="e.g. SAVE10"
            />
          </Field>
          <Field label="Shipping amount">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-goose-text-light">{currency.symbol}</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={shippingAmount}
                onChange={(e) => setShippingAmount(e.target.value)}
                className="input pl-7"
                placeholder="Auto"
              />
            </div>
          </Field>
        </div>
        <p className="text-xs text-goose-text-light">
          Leave shipping blank to let the store calculate it. An invalid discount code will block creation.
        </p>
      </div>

      {/* Initial status */}
      <div className="pt-4 border-t border-goose-border space-y-3">
        <h3 className="text-sm font-display font-semibold text-goose-text">Initial Status</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Order status">
            <select value={createStatus} onChange={(e) => setCreateStatus(e.target.value)} className="input">
              {ORDER_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Payment status">
            <select value={createPaymentStatus} onChange={(e) => setCreatePaymentStatus(e.target.value)} className="input">
              {PAYMENT_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <Field label="Order notes">
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input" rows={2} placeholder="Optional notes..." />
      </Field>

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-goose-border">
        <button
          type="submit"
          disabled={saving || !email.trim() || !firstName.trim() || !lastName.trim() || lineItems.length === 0}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <LoadingSpinner size="sm" />}
          Create Order
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="px-4 py-2.5 text-sm font-medium text-goose-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function shipmentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-gray-100 text-goose-text-light',
    label_created: 'bg-blue-50 text-blue-600',
    shipped: 'bg-blue-100 text-blue-700',
    in_transit: 'bg-blue-100 text-blue-700',
    out_for_delivery: 'bg-yellow-100 text-yellow-700',
    delivered: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    returned: 'bg-purple-100 text-purple-700',
    cancelled: 'bg-red-50 text-red-600',
  };
  return colors[status] ?? 'bg-gray-100 text-goose-text-light';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-goose-text mb-1">{label}</label>
      {children}
    </div>
  );
}
