import { useState, useEffect } from 'react';
import { useMcp } from '../hooks/useMcp';
import { useConnectionStore } from '../stores/connectionStore';
import { MCP_TOOLS } from '../../shared/mcpTools';
import { LoadingSpinner } from './LoadingSpinner';
import type { Product, Category, Tag, AttributeGroup, ProductAttribute, VariationType, ProductVariation, Outlet, ProductOutletLink } from '../../shared/types';

interface ProductFormProps {
  product?: Product | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ProductForm({ product, onClose, onSaved }: ProductFormProps) {
  const { callTool } = useMcp();
  const { locationsEnabled } = useConnectionStore();
  const isEdit = !!product;
  // Treat null (still probing) as "show the tab" so we don't flash; only hide once we're sure it's off
  const showLocations = locationsEnabled !== false;

  // Basic fields
  const [name, setName] = useState(product?.name ?? '');
  const [productType, setProductType] = useState(product?.product_type ?? 'simple');
  const [availableProductTypes, setAvailableProductTypes] = useState<Array<{ slug: string; label: string; description: string; active: boolean }>>([]);
  const [sku, setSku] = useState(product?.sku ?? '');
  const [price, setPrice] = useState(product?.price ?? '');
  const [salePrice, setSalePrice] = useState(product?.sale_price ?? '');
  const [stock, setStock] = useState(String(product?.stock ?? product?.stock_quantity ?? '0'));
  const [stockStatus, setStockStatus] = useState(product?.stock_status ?? 'instock');
  const [lowStockThreshold, setLowStockThreshold] = useState(
    product?.low_stock_threshold != null ? String(product.low_stock_threshold) : ''
  );
  const [status, setStatus] = useState(product?.status ?? 'active');
  const [description, setDescription] = useState(product?.description ?? '');
  const [shortDescription, setShortDescription] = useState(product?.short_description ?? '');
  const [weight, setWeight] = useState(product?.weight != null ? String(product.weight) : '');
  const [featured, setFeatured] = useState(product?.featured ?? false);
  const [restockDate, setRestockDate] = useState(product?.restock_date ?? '');

  // Listing address (Locations premium component, single-location use case)
  const [listingAddress1, setListingAddress1] = useState(product?.listing_address_1 ?? '');
  const [listingAddress2, setListingAddress2] = useState(product?.listing_address_2 ?? '');
  const [listingCity, setListingCity] = useState(product?.listing_city ?? '');
  const [listingState, setListingState] = useState(product?.listing_state ?? '');
  const [listingPostcode, setListingPostcode] = useState(product?.listing_postcode ?? '');
  const [listingCountry, setListingCountry] = useState(product?.listing_country ?? '');
  const [listingDisplay, setListingDisplay] = useState<'exact' | 'approximate' | 'hidden'>(product?.listing_display ?? 'exact');
  // lat/lng come from the plugin's geocoder; we render them read-only
  const listingLat = product?.listing_lat;
  const listingLng = product?.listing_lng;

  // Outlets stocking this product (junction-table use case)
  const [productOutlets, setProductOutlets] = useState<ProductOutletLink[]>([]);
  const [allOutlets, setAllOutlets] = useState<Outlet[]>([]);
  const [loadingOutlets, setLoadingOutlets] = useState(false);
  const [attachOutletId, setAttachOutletId] = useState<string>('');
  const [attachStock, setAttachStock] = useState<string>('');
  const [attachStatus, setAttachStatus] = useState<'instock' | 'outofstock' | 'onbackorder'>('instock');
  const [attaching, setAttaching] = useState(false);

  // Categories & Tags
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [loadingTaxonomies, setLoadingTaxonomies] = useState(false);

  // Attributes
  const [attributeGroups, setAttributeGroups] = useState<AttributeGroup[]>([]);
  const [productAttributes, setProductAttributes] = useState<Record<number, string | number>>({});
  const [loadingAttributes, setLoadingAttributes] = useState(false);

  // Variations
  const [variationTypes, setVariationTypes] = useState<VariationType[]>([]);
  const [configuredTypeIds, setConfiguredTypeIds] = useState<number[]>([]);
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [loadingVariations, setLoadingVariations] = useState(false);
  const [stockMode, setStockMode] = useState<'parent' | 'variation'>('variation');

  // Documents (edit mode)
  interface ProductDocument {
    id: number;
    name: string;
    file_url: string;
    file_type: string;
    file_size: number;
    file_size_formatted?: string;
    description?: string;
    display_order?: number;
  }
  const [documents, setDocuments] = useState<ProductDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Images (edit mode)
  const [productImageUrl, setProductImageUrl] = useState(product?.image_url ?? '');
  const [galleryImages, setGalleryImages] = useState<Array<{ id: number; url: string }>>([]);
  const [mediaLibrary, setMediaLibrary] = useState<Array<{ id: number; title: string; url: string; thumbnail: string }>>([]);
  const [mediaSearch, setMediaSearch] = useState('');
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [uploadUrl, setUploadUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<'general' | 'categories' | 'attributes' | 'variations' | 'images' | 'documents' | 'locations'>('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load product types, categories, tags, attributes, variations, documents on mount
  useEffect(() => {
    loadProductTypes();
    loadTaxonomies();
    loadAttributes();
    loadVariations();
    if (isEdit) {
      loadDocuments();
      if (showLocations) {
        loadOutletPool();
        loadProductOutlets();
      }
    }
  }, []);

  const loadProductTypes = async () => {
    try {
      const result = await callTool(MCP_TOOLS.LIST_PRODUCT_TYPES, {});
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        setAvailableProductTypes(data.product_types ?? []);
      }
    } catch (err) {
      console.error('Failed to load product types:', err);
    }
  };

  const loadTaxonomies = async () => {
    setLoadingTaxonomies(true);
    try {
      const [catResult, tagResult] = await Promise.all([
        callTool(MCP_TOOLS.LIST_CATEGORIES, { include_counts: true }),
        callTool(MCP_TOOLS.LIST_TAGS, { include_counts: true }),
      ]);

      if (catResult?.content?.[0]?.text) {
        const data = JSON.parse(catResult.content[0].text);
        const cats: Category[] = Array.isArray(data) ? data : data.categories ?? [];
        setAllCategories(cats);

        // Match product's categories by slug (search_products only returns name/slug, not id)
        if (isEdit && product?.categories?.length) {
          const productSlugs = new Set(product.categories.map(c => c.slug));
          setSelectedCategoryIds(cats.filter(c => productSlugs.has(c.slug)).map(c => c.id));
        }
      }
      if (tagResult?.content?.[0]?.text) {
        const data = JSON.parse(tagResult.content[0].text);
        const tags: Tag[] = Array.isArray(data) ? data : data.tags ?? [];
        setAllTags(tags);

        // Match product's tags by slug if available
        if (isEdit && product?.tags?.length) {
          const productTagSlugs = new Set(product.tags.map(t => t.slug));
          setSelectedTagIds(tags.filter(t => productTagSlugs.has(t.slug)).map(t => t.id));
        }
      }
    } catch (err) {
      console.error('Failed to load taxonomies:', err);
    } finally {
      setLoadingTaxonomies(false);
    }
  };

  const loadAttributes = async () => {
    setLoadingAttributes(true);
    try {
      const groupResult = await callTool(MCP_TOOLS.LIST_ATTRIBUTE_GROUPS, { include_attributes: true });
      if (groupResult?.content?.[0]?.text) {
        const data = JSON.parse(groupResult.content[0].text);
        const groups: AttributeGroup[] = Array.isArray(data) ? data : data.groups ?? [];
        setAttributeGroups(groups);
      }

      // Load existing product attribute values if editing
      if (isEdit && product) {
        const attrResult = await callTool(MCP_TOOLS.GET_PRODUCT_ATTRIBUTES, { product_id: product.id });
        if (attrResult?.content?.[0]?.text) {
          const data = JSON.parse(attrResult.content[0].text);
          const attrs: Array<{ attribute_id: number; value: string | number }> =
            Array.isArray(data) ? data : data.attributes ?? [];
          const map: Record<number, string | number> = {};
          for (const a of attrs) {
            map[a.attribute_id] = a.value;
          }
          setProductAttributes(map);
        }
      }
    } catch (err) {
      console.error('Failed to load attributes:', err);
    } finally {
      setLoadingAttributes(false);
    }
  };

  const loadDocuments = async () => {
    if (!product) return;
    setLoadingDocuments(true);
    try {
      const result = await callTool(MCP_TOOLS.GET_PRODUCT_DOCUMENTS, { product_id: product.id });
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        setDocuments(data.documents ?? []);
      }
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const handleAddDocument = async () => {
    if (!product) return;
    const picked = await window.electronAPI.dialog.pickFile();
    if (!picked) return;

    setUploadingDoc(true);
    setError(null);
    try {
      // Upload file to media library
      const uploadResult = await callTool(MCP_TOOLS.UPLOAD_FILE_BASE64, {
        data: picked.base64,
        filename: picked.filename,
        mime: picked.mime,
        title: picked.filename,
      });

      if (uploadResult?.content?.[0]?.text) {
        const data = JSON.parse(uploadResult.content[0].text);
        if (!data.success || !data.attachment_id) {
          setError(data.error ?? 'Failed to upload file');
          return;
        }

        // Attach to product
        const attachResult = await callTool(MCP_TOOLS.ADD_PRODUCT_DOCUMENT, {
          product_id: product.id,
          attachment_id: data.attachment_id,
          name: picked.filename,
        });

        if (attachResult?.content?.[0]?.text) {
          const attachData = JSON.parse(attachResult.content[0].text);
          if (!attachData.success) {
            setError(attachData.error ?? 'Failed to attach document to product');
            return;
          }
        }

        loadDocuments();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add document');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    setSaving(true);
    setError(null);
    try {
      const result = await callTool(MCP_TOOLS.DELETE_PRODUCT_DOCUMENT, { document_id: documentId });
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        if (!data.success) {
          setError(data.error ?? 'Failed to delete document');
          return;
        }
      }
      loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setSaving(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes < 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const loadVariations = async () => {
    setLoadingVariations(true);
    try {
      // Load all variation types (e.g. Color, Size)
      const typesResult = await callTool(MCP_TOOLS.LIST_VARIATION_ATTRIBUTES, {});
      if (typesResult?.content?.[0]?.text) {
        const data = JSON.parse(typesResult.content[0].text);
        setVariationTypes(data.variation_types ?? []);
      }

      // Load product-specific variation config and variations
      if (isEdit && product) {
        const varResult = await callTool(MCP_TOOLS.GET_PRODUCT_VARIATIONS, { product_id: product.id });
        if (varResult?.content?.[0]?.text) {
          const data = JSON.parse(varResult.content[0].text);
          setConfiguredTypeIds((data.configured_types ?? []).map((t: any) => t.type_id));
          setVariations(data.variations ?? []);
        }
      }
    } catch (err) {
      console.error('Failed to load variations:', err);
    } finally {
      setLoadingVariations(false);
    }
  };

  const loadMediaLibrary = async (search?: string) => {
    setLoadingMedia(true);
    try {
      const args: Record<string, unknown> = { limit: 40 };
      if (search?.trim()) args.search = search.trim();
      const result = await callTool(MCP_TOOLS.LIST_MEDIA_IMAGES, args);
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        setMediaLibrary(data.images ?? []);
      }
    } catch (err) {
      console.error('Failed to load media:', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleSetProductImage = async (imageId: number) => {
    if (!product) return;
    setSaving(true);
    setError(null);
    try {
      const result = await callTool(MCP_TOOLS.SET_PRODUCT_IMAGE, { product_id: product.id, image_id: imageId });
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        if (data.image_url) setProductImageUrl(data.image_url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set image');
    } finally {
      setSaving(false);
    }
  };

  const handleAddGalleryImage = async (imageId: number) => {
    if (!product) return;
    setSaving(true);
    setError(null);
    try {
      const result = await callTool(MCP_TOOLS.ADD_PRODUCT_GALLERY_IMAGE, { product_id: product.id, image_id: imageId });
      if (result?.content?.[0]?.text) {
        const data = JSON.parse(result.content[0].text);
        if (data.gallery) setGalleryImages(data.gallery);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add gallery image');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLocal = async (mode: 'main' | 'gallery') => {
    if (!product) return;
    const picked = await window.electronAPI.dialog.pickImage();
    if (!picked) return;

    setUploading(true);
    setError(null);
    try {
      // Upload to WordPress media library via MCP tool
      const uploadResult = await callTool(MCP_TOOLS.UPLOAD_IMAGE_BASE64, {
        data: picked.base64,
        filename: picked.filename,
        mime: picked.mime,
      });

      if (uploadResult?.content?.[0]?.text) {
        const data = JSON.parse(uploadResult.content[0].text);
        if (data.success && data.attachment_id) {
          if (mode === 'main') {
            await handleSetProductImage(data.attachment_id);
            if (data.url) setProductImageUrl(data.url);
          } else {
            await handleAddGalleryImage(data.attachment_id);
          }
        } else {
          setError(data.error ?? 'Failed to upload image');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload local image');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadFromUrl = async (mode: 'main' | 'gallery') => {
    if (!product || !uploadUrl.trim()) return;
    setUploading(true);
    setError(null);
    try {
      if (mode === 'main') {
        const result = await callTool(MCP_TOOLS.SET_PRODUCT_IMAGE, { product_id: product.id, image_url: uploadUrl.trim() });
        if (result?.content?.[0]?.text) {
          const data = JSON.parse(result.content[0].text);
          if (data.image_url) setProductImageUrl(data.image_url);
        }
      } else {
        const result = await callTool(MCP_TOOLS.ADD_PRODUCT_GALLERY_IMAGE, { product_id: product.id, image_url: uploadUrl.trim() });
        if (result?.content?.[0]?.text) {
          const data = JSON.parse(result.content[0].text);
          if (data.gallery) setGalleryImages(data.gallery);
        }
      }
      setUploadUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleConfigureVariations = async (typeIds: number[]) => {
    if (!product) return;
    setSaving(true);
    setError(null);
    try {
      await callTool(MCP_TOOLS.CONFIGURE_PRODUCT_VARIATIONS, {
        product_id: product.id,
        attribute_ids: typeIds,
        enable_variations: typeIds.length > 0,
        stock_mode: stockMode,
      });
      setConfiguredTypeIds(typeIds);
      loadVariations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to configure variations');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateVariations = async () => {
    if (!product) return;
    setSaving(true);
    setError(null);
    try {
      await callTool(MCP_TOOLS.GENERATE_PRODUCT_VARIATIONS, {
        product_id: product.id,
        base_sku: product.sku || undefined,
        base_price: price ? parseFloat(price) : undefined,
        base_stock: stock ? parseInt(stock, 10) : undefined,
      });
      loadVariations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate variations');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateVariation = async (variationId: number, updates: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      await callTool(MCP_TOOLS.UPDATE_PRODUCT_VARIATION, { variation_id: variationId, ...updates });
      loadVariations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update variation');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariation = async (variationId: number) => {
    setSaving(true);
    setError(null);
    try {
      await callTool(MCP_TOOLS.DELETE_PRODUCT_VARIATION, { variation_id: variationId });
      loadVariations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete variation');
    } finally {
      setSaving(false);
    }
  };

  const loadOutletPool = async () => {
    try {
      const result = await callTool(MCP_TOOLS.LIST_OUTLETS, { status: 'active', limit: 500 });
      const text = result?.content?.[0]?.text;
      if (text) {
        const data = JSON.parse(text);
        if (data?.success !== false) {
          setAllOutlets(data.outlets ?? []);
        }
      }
    } catch (err) {
      console.error('Failed to load outlet pool:', err);
    }
  };

  const loadProductOutlets = async () => {
    if (!product) return;
    setLoadingOutlets(true);
    try {
      const result = await callTool(MCP_TOOLS.LIST_PRODUCT_OUTLETS, { product_id: product.id });
      const text = result?.content?.[0]?.text;
      if (text) {
        const data = JSON.parse(text);
        if (data?.success !== false) {
          setProductOutlets(data.outlets ?? data.product_outlets ?? []);
        }
      }
    } catch (err) {
      console.error('Failed to load product outlets:', err);
    } finally {
      setLoadingOutlets(false);
    }
  };

  const handleAttachOutlet = async () => {
    if (!product || !attachOutletId) return;
    setAttaching(true);
    setError(null);
    try {
      const args: Record<string, unknown> = {
        product_id: product.id,
        outlet_id: parseInt(attachOutletId, 10),
        stock_status: attachStatus,
      };
      if (attachStock.trim() !== '') args.stock = parseInt(attachStock, 10);

      const res = await callTool(MCP_TOOLS.ATTACH_OUTLET_TO_PRODUCT, args);
      const text = res?.content?.[0]?.text;
      if (text) {
        const data = JSON.parse(text);
        if (data?.success === false) {
          setError(data.message ?? data.error ?? 'Failed to attach outlet');
          return;
        }
      }
      setAttachOutletId('');
      setAttachStock('');
      setAttachStatus('instock');
      loadProductOutlets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach outlet');
    } finally {
      setAttaching(false);
    }
  };

  const handleUpdateOutletLink = async (link: ProductOutletLink, patch: Partial<ProductOutletLink>) => {
    if (!product) return;
    try {
      const merged = { ...link, ...patch };
      const args: Record<string, unknown> = {
        product_id: product.id,
        outlet_id: merged.outlet_id,
        stock_status: merged.stock_status,
      };
      if (merged.stock != null) args.stock = merged.stock;
      await callTool(MCP_TOOLS.ATTACH_OUTLET_TO_PRODUCT, args);
      // Optimistic local update
      setProductOutlets((prev) => prev.map((l) => (l.outlet_id === link.outlet_id ? merged : l)));
    } catch (err) {
      console.error('Failed to update outlet link:', err);
      loadProductOutlets(); // revert to server truth
    }
  };

  const handleDetachOutlet = async (outletId: number) => {
    if (!product) return;
    try {
      await callTool(MCP_TOOLS.DETACH_OUTLET_FROM_PRODUCT, { product_id: product.id, outlet_id: outletId });
      loadProductOutlets();
    } catch (err) {
      console.error('Failed to detach outlet:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const args: Record<string, unknown> = {
        name: name.trim(),
        product_type: productType,
        status,
        featured,
      };
      if (sku.trim()) args.sku = sku.trim();
      if (price) args.price = parseFloat(price);
      if (salePrice) args.sale_price = parseFloat(salePrice);
      if (stock) args.stock = parseInt(stock, 10);
      if (description.trim()) args.description = description.trim();
      if (shortDescription.trim()) args.short_description = shortDescription.trim();
      if (weight) args.weight = parseFloat(weight);
      if (lowStockThreshold) args.low_stock_threshold = parseInt(lowStockThreshold, 10);
      if (restockDate) args.restock_date = restockDate;

      // Listing fields (Locations premium component). Only send when the feature is active.
      if (showLocations) {
        if (listingAddress1.trim()) args.listing_address_1 = listingAddress1.trim();
        if (listingAddress2.trim()) args.listing_address_2 = listingAddress2.trim();
        if (listingCity.trim()) args.listing_city = listingCity.trim();
        if (listingState.trim()) args.listing_state = listingState.trim();
        if (listingPostcode.trim()) args.listing_postcode = listingPostcode.trim();
        if (listingCountry.trim()) args.listing_country = listingCountry.trim().toUpperCase().slice(0, 2);
        args.listing_display = listingDisplay;
      }

      let productId = product?.id;

      if (isEdit) {
        args.product_id = product!.id;
        await callTool(MCP_TOOLS.UPDATE_PRODUCT, args);
      } else {
        const result = await callTool(MCP_TOOLS.CREATE_PRODUCT, args);
        if (result?.content?.[0]?.text) {
          const data = JSON.parse(result.content[0].text);
          productId = data.product?.id ?? data.id;
        }
      }

      // Save categories and tags (only if we have a product ID)
      if (productId) {
        await Promise.all([
          callTool(MCP_TOOLS.ASSIGN_PRODUCT_CATEGORIES, {
            product_id: productId,
            category_ids: selectedCategoryIds,
            mode: 'replace',
          }),
          callTool(MCP_TOOLS.ASSIGN_PRODUCT_TAGS, {
            product_id: productId,
            tag_ids: selectedTagIds,
            mode: 'replace',
          }),
        ]);

        // Save attribute values
        const attrValues = Object.entries(productAttributes)
          .filter(([, v]) => v !== '' && v != null)
          .map(([attrId, value]) => ({ attribute_id: parseInt(attrId, 10), value }));

        if (attrValues.length > 0) {
          await callTool(MCP_TOOLS.SET_PRODUCT_ATTRIBUTES, {
            product_id: productId,
            attributes: attrValues,
          });
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const toggleCategory = (id: number) => {
    setSelectedCategoryIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleTag = (id: number) => {
    setSelectedTagIds(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  };

  const tabs = [
    { key: 'general' as const, label: 'General' },
    { key: 'categories' as const, label: 'Categories & Tags' },
    { key: 'attributes' as const, label: 'Attributes' },
    ...(isEdit ? [
      { key: 'images' as const, label: 'Images' },
      { key: 'documents' as const, label: 'Documents' },
      { key: 'variations' as const, label: 'Variations' },
    ] : []),
    ...(showLocations ? [{ key: 'locations' as const, label: 'Locations' }] : []),
  ];

  return (
    <form onSubmit={handleSubmit} className="flex flex-col h-full">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 mb-4">{error}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-goose-border">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === t.key
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-goose-text-light hover:text-goose-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto space-y-5">
        {/* ── General tab ── */}
        {activeTab === 'general' && (
          <>
            <Field label="Product name *">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="input"
                placeholder="e.g. Organic Coffee Beans"
              />
            </Field>

            {availableProductTypes.length > 0 && (
              <Field label="Product type">
                <select value={productType} onChange={(e) => setProductType(e.target.value)} className="input">
                  {availableProductTypes.filter(t => t.active).map(t => (
                    <option key={t.slug} value={t.slug}>{t.label}</option>
                  ))}
                </select>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="SKU">
                <input type="text" value={sku} onChange={(e) => setSku(e.target.value)} className="input" placeholder="ABC-001" />
              </Field>
              <Field label="Status">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="input">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Price">
                <input type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="input" placeholder="0.00" />
              </Field>
              <Field label="Sale price">
                <input type="number" step="0.01" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} className="input" placeholder="0.00" />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <Field label="Stock quantity">
                <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="input" />
              </Field>
              <Field label="Stock status">
                <select value={stockStatus} onChange={(e) => setStockStatus(e.target.value as any)} className="input">
                  <option value="instock">In Stock</option>
                  <option value="outofstock">Out of Stock</option>
                  <option value="onbackorder">On Backorder</option>
                </select>
              </Field>
              <Field label="Low stock alert">
                <input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="input" placeholder="e.g. 5" />
              </Field>
            </div>

            {(stockStatus === 'outofstock' || stockStatus === 'onbackorder') && (
              <Field label="Expected restock date">
                <input
                  type="date"
                  value={restockDate}
                  onChange={(e) => setRestockDate(e.target.value)}
                  className="input"
                />
                <p className="text-xs text-goose-text-light mt-1">Shown to customers on the product page while it's unavailable.</p>
              </Field>
            )}

            <Field label="Weight">
              <input type="number" step="0.01" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} className="input" placeholder="kg" />
            </Field>

            <Field label="Short description">
              <textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} className="input" rows={2} placeholder="Brief summary..." />
            </Field>

            <Field label="Description">
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} className="input" rows={4} placeholder="Full product description..." />
            </Field>

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
              <span className="text-sm text-goose-text">Featured product</span>
            </label>
          </>
        )}

        {/* ── Categories & Tags tab ── */}
        {activeTab === 'categories' && (
          <>
            {loadingTaxonomies ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : (
              <>
                <div>
                  <h3 className="text-sm font-medium text-goose-text mb-2">Categories</h3>
                  {allCategories.length === 0 ? (
                    <p className="text-sm text-goose-text-light">No categories found. Create categories in your store first.</p>
                  ) : (
                    <div className="border border-goose-border rounded-lg max-h-48 overflow-y-auto">
                      {allCategories.map(cat => (
                        <label
                          key={cat.id}
                          className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-goose-border last:border-b-0"
                        >
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(cat.id)}
                            onChange={() => toggleCategory(cat.id)}
                            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <span className="text-sm text-goose-text flex-1">{cat.name}</span>
                          {cat.product_count != null && (
                            <span className="text-xs text-goose-text-light">{cat.product_count}</span>
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-goose-text mb-2">Tags</h3>
                  {allTags.length === 0 ? (
                    <p className="text-sm text-goose-text-light">No tags found. Create tags in your store first.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {allTags.map(tag => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                            selectedTagIds.includes(tag.id)
                              ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300'
                              : 'bg-gray-100 text-goose-text-light hover:bg-gray-200'
                          }`}
                        >
                          {tag.name}
                          {tag.product_count != null && ` (${tag.product_count})`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ── Attributes tab ── */}
        {activeTab === 'attributes' && (
          <>
            {loadingAttributes ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : attributeGroups.length === 0 ? (
              <p className="text-sm text-goose-text-light">No attribute groups defined. Create attribute groups in your store to add custom product properties.</p>
            ) : (
              attributeGroups.map(group => (
                <div key={group.id}>
                  <h3 className="text-sm font-medium text-goose-text mb-2">{group.name}</h3>
                  {group.description && (
                    <p className="text-xs text-goose-text-light mb-2">{group.description}</p>
                  )}
                  <div className="space-y-3">
                    {(group.attributes ?? []).map(attr => (
                      <AttributeField
                        key={attr.id}
                        attribute={attr}
                        value={productAttributes[attr.id] ?? ''}
                        onChange={(val) => setProductAttributes(prev => ({ ...prev, [attr.id]: val }))}
                      />
                    ))}
                    {(!group.attributes || group.attributes.length === 0) && (
                      <p className="text-xs text-goose-text-light">No attributes in this group.</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* ── Images tab (edit mode only) ── */}
        {activeTab === 'images' && isEdit && (
          <>
            {/* Current product image */}
            <div>
              <h3 className="text-sm font-medium text-goose-text mb-2">Product Image</h3>
              {productImageUrl ? (
                <div className="flex items-start gap-3">
                  <img src={productImageUrl} alt="Product" className="w-28 h-28 object-cover rounded-lg border border-goose-border" />
                  <p className="text-xs text-goose-text-light mt-1">Select a new image from the media library below or upload from URL to replace.</p>
                </div>
              ) : (
                <p className="text-sm text-goose-text-light">No product image set. Choose one from the media library or upload from URL.</p>
              )}
            </div>

            {/* Gallery images */}
            {(product?.images && product.images.length > 1) || galleryImages.length > 0 ? (
              <div>
                <h3 className="text-sm font-medium text-goose-text mb-2">Gallery</h3>
                <div className="flex gap-2 flex-wrap">
                  {(galleryImages.length > 0 ? galleryImages : (product?.images?.slice(1) ?? []).map((url, i) => ({ id: i, url }))).map((img, i) => (
                    <img key={i} src={typeof img === 'string' ? img : img.url} alt={`Gallery ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border border-goose-border" />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Upload from computer */}
            <div>
              <h3 className="text-sm font-medium text-goose-text mb-2">Upload from Computer</h3>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleUploadLocal('main')}
                  disabled={uploading}
                  className="flex-1 px-3 py-2 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {uploading ? <LoadingSpinner size="sm" /> : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                  Choose as Main Image
                </button>
                <button
                  type="button"
                  onClick={() => handleUploadLocal('gallery')}
                  disabled={uploading}
                  className="flex-1 px-3 py-2 text-xs font-medium text-goose-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  Add to Gallery
                </button>
              </div>
            </div>

            {/* Upload from URL */}
            <div>
              <h3 className="text-sm font-medium text-goose-text mb-2">Upload from URL</h3>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="input flex-1"
                />
                <button
                  type="button"
                  onClick={() => handleUploadFromUrl('main')}
                  disabled={uploading || !uploadUrl.trim()}
                  className="px-3 py-2 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {uploading ? <LoadingSpinner size="sm" /> : 'Set as Main'}
                </button>
                <button
                  type="button"
                  onClick={() => handleUploadFromUrl('gallery')}
                  disabled={uploading || !uploadUrl.trim()}
                  className="px-3 py-2 text-xs font-medium text-goose-text bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  Add to Gallery
                </button>
              </div>
            </div>

            {/* Media library browser */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-goose-text">Media Library</h3>
                {!loadingMedia && mediaLibrary.length === 0 && (
                  <button
                    type="button"
                    onClick={() => loadMediaLibrary()}
                    className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    Browse Media
                  </button>
                )}
              </div>

              {mediaLibrary.length > 0 && (
                <div className="mb-2">
                  <input
                    type="text"
                    value={mediaSearch}
                    onChange={(e) => { setMediaSearch(e.target.value); loadMediaLibrary(e.target.value); }}
                    placeholder="Search media..."
                    className="input text-xs"
                  />
                </div>
              )}

              {loadingMedia ? (
                <div className="flex justify-center py-6"><LoadingSpinner /></div>
              ) : mediaLibrary.length > 0 ? (
                <div className="grid grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                  {mediaLibrary.map(img => (
                    <div key={img.id} className="group relative">
                      <img
                        src={img.thumbnail || img.url}
                        alt={img.title}
                        className="w-full aspect-square object-cover rounded border border-goose-border"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded flex flex-col items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSetProductImage(img.id)}
                          disabled={saving}
                          className="px-2 py-1 text-[10px] font-medium text-white bg-primary-600 rounded hover:bg-primary-700 transition-colors"
                        >
                          Set as Main
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddGalleryImage(img.id)}
                          disabled={saving}
                          className="px-2 py-1 text-[10px] font-medium text-white bg-gray-600 rounded hover:bg-gray-700 transition-colors"
                        >
                          Add to Gallery
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </>
        )}

        {/* ── Documents tab (edit mode only) ── */}
        {activeTab === 'documents' && isEdit && (
          <>
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-goose-text">Product Documents</h3>
                <button
                  type="button"
                  onClick={handleAddDocument}
                  disabled={uploadingDoc}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {uploadingDoc ? <LoadingSpinner size="sm" /> : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  )}
                  Add Document
                </button>
              </div>

              <p className="text-xs text-goose-text-light mb-3">
                Attach manuals, safety sheets, CAD files, or other documents to this product. Files are uploaded to your WordPress media library.
              </p>

              {loadingDocuments ? (
                <div className="flex justify-center py-6"><LoadingSpinner /></div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8 text-sm text-goose-text-light border border-dashed border-goose-border rounded-lg">
                  No documents attached. Click <strong>Add Document</strong> to upload one.
                </div>
              ) : (
                <div className="border border-goose-border rounded-lg divide-y divide-goose-border">
                  {documents.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                      <svg className="w-8 h-8 text-goose-text-light shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-goose-text truncate">{doc.name}</p>
                        <p className="text-xs text-goose-text-light">
                          {doc.file_size_formatted ?? formatBytes(doc.file_size)}
                          {doc.file_type ? ` · ${doc.file_type}` : ''}
                        </p>
                        {doc.description && (
                          <p className="text-xs text-goose-text-light mt-0.5 truncate">{doc.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => window.electronAPI.shell.openExternal(doc.file_url)}
                        className="p-1.5 text-goose-text-light hover:text-primary-600 transition-colors"
                        title="Open"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        disabled={saving}
                        className="p-1.5 text-goose-text-light hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Locations tab (Locations premium component) ── */}
        {activeTab === 'locations' && showLocations && (
          <>
            {/* Listing address: single address ON the product (classified / property mode) */}
            <div>
              <h3 className="text-sm font-medium text-goose-text mb-1">Listing address</h3>
              <p className="text-xs text-goose-text-light mb-3">
                Use this when the product IS a location (e.g. property, vehicle, classified listing). Leave blank if not applicable.
              </p>
              <div className="space-y-3">
                <Field label="Address line 1">
                  <input type="text" value={listingAddress1} onChange={(e) => setListingAddress1(e.target.value)} className="input" />
                </Field>
                <Field label="Address line 2">
                  <input type="text" value={listingAddress2} onChange={(e) => setListingAddress2(e.target.value)} className="input" />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="City">
                    <input type="text" value={listingCity} onChange={(e) => setListingCity(e.target.value)} className="input" />
                  </Field>
                  <Field label="County / State">
                    <input type="text" value={listingState} onChange={(e) => setListingState(e.target.value)} className="input" />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Postcode">
                    <input type="text" value={listingPostcode} onChange={(e) => setListingPostcode(e.target.value)} className="input" />
                  </Field>
                  <Field label="Country (ISO)">
                    <input
                      type="text"
                      value={listingCountry}
                      onChange={(e) => setListingCountry(e.target.value.toUpperCase().slice(0, 2))}
                      className="input uppercase"
                      maxLength={2}
                      placeholder="GB"
                    />
                  </Field>
                  <Field label="Display mode">
                    <select value={listingDisplay} onChange={(e) => setListingDisplay(e.target.value as 'exact' | 'approximate' | 'hidden')} className="input">
                      <option value="exact">Exact pin</option>
                      <option value="approximate">Approximate</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </Field>
                </div>
                <p className="text-xs text-goose-text-light">
                  Coordinates: {listingLat != null && listingLng != null
                    ? `${Number(listingLat).toFixed(5)}, ${Number(listingLng).toFixed(5)}`
                    : 'auto-geocoded when you save the address'}
                </p>
              </div>
            </div>

            {/* Outlets stocking this product (shared outlet pool) */}
            {isEdit && (
              <div className="pt-4 border-t border-goose-border">
                <h3 className="text-sm font-medium text-goose-text mb-1">Outlets stocking this product</h3>
                <p className="text-xs text-goose-text-light mb-3">
                  Link this product to shops/outlets from the shared pool. Each outlet can hold its own stock level.
                </p>

                {loadingOutlets ? (
                  <div className="flex justify-center py-4"><LoadingSpinner size="sm" /></div>
                ) : productOutlets.length === 0 ? (
                  <p className="text-sm text-goose-text-light py-2">Not stocked at any outlet yet.</p>
                ) : (
                  <div className="border border-goose-border rounded-lg divide-y divide-goose-border mb-3">
                    {productOutlets.map((link) => (
                      <div key={link.outlet_id} className="flex items-center gap-3 px-3 py-2">
                        <span className="flex-1 text-sm text-goose-text">
                          {link.outlet_name ?? allOutlets.find((o) => o.id === link.outlet_id)?.name ?? `Outlet #${link.outlet_id}`}
                        </span>
                        <input
                          type="number"
                          min="0"
                          value={link.stock ?? ''}
                          onChange={(e) => {
                            const next = e.target.value === '' ? null : parseInt(e.target.value, 10);
                            handleUpdateOutletLink(link, { stock: next });
                          }}
                          className="w-20 px-2 py-1 border border-goose-border rounded text-sm text-center"
                          placeholder="—"
                          title="Stock at this outlet (blank = untracked)"
                        />
                        <select
                          value={link.stock_status}
                          onChange={(e) => handleUpdateOutletLink(link, { stock_status: e.target.value as 'instock' | 'outofstock' | 'onbackorder' })}
                          className="px-2 py-1 border border-goose-border rounded text-xs"
                        >
                          <option value="instock">In stock</option>
                          <option value="outofstock">Out of stock</option>
                          <option value="onbackorder">Backorder</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleDetachOutlet(link.outlet_id)}
                          className="p-1 text-goose-text-light hover:text-red-600"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Attach a new outlet */}
                {allOutlets.length === 0 ? (
                  <p className="text-xs text-goose-text-light">No outlets defined yet. Create some on the Locations page first.</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={attachOutletId}
                      onChange={(e) => setAttachOutletId(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-goose-border rounded text-sm"
                    >
                      <option value="">Pick an outlet to add...</option>
                      {allOutlets
                        .filter((o) => !productOutlets.some((link) => link.outlet_id === o.id))
                        .map((o) => (
                          <option key={o.id} value={o.id}>{o.name}{o.city ? ` — ${o.city}` : ''}</option>
                        ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      value={attachStock}
                      onChange={(e) => setAttachStock(e.target.value)}
                      className="w-20 px-2 py-1.5 border border-goose-border rounded text-sm text-center"
                      placeholder="Stock"
                    />
                    <select
                      value={attachStatus}
                      onChange={(e) => setAttachStatus(e.target.value as 'instock' | 'outofstock' | 'onbackorder')}
                      className="px-2 py-1.5 border border-goose-border rounded text-xs"
                    >
                      <option value="instock">In stock</option>
                      <option value="outofstock">Out of stock</option>
                      <option value="onbackorder">Backorder</option>
                    </select>
                    <button
                      type="button"
                      onClick={handleAttachOutlet}
                      disabled={attaching || !attachOutletId}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                    >
                      {attaching ? <LoadingSpinner size="sm" /> : 'Attach'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {!isEdit && (
              <p className="text-sm text-goose-text-light pt-4 border-t border-goose-border">
                Save the product first, then you can attach outlets to it.
              </p>
            )}
          </>
        )}

        {/* ── Variations tab (edit mode only) ── */}
        {activeTab === 'variations' && isEdit && (
          <>
            {loadingVariations ? (
              <div className="flex justify-center py-8"><LoadingSpinner /></div>
            ) : (
              <>
                {/* Configure which variation types this product uses */}
                <div>
                  <h3 className="text-sm font-medium text-goose-text mb-2">Variation Types</h3>
                  {variationTypes.length === 0 ? (
                    <p className="text-sm text-goose-text-light">No variation types defined. Create variation attributes (e.g. Color, Size) in your store first.</p>
                  ) : (
                    <>
                      <div className="border border-goose-border rounded-lg max-h-40 overflow-y-auto">
                        {variationTypes.map(vt => (
                          <label
                            key={vt.id}
                            className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-goose-border last:border-b-0"
                          >
                            <input
                              type="checkbox"
                              checked={configuredTypeIds.includes(vt.id)}
                              onChange={() => {
                                const newIds = configuredTypeIds.includes(vt.id)
                                  ? configuredTypeIds.filter(id => id !== vt.id)
                                  : [...configuredTypeIds, vt.id];
                                handleConfigureVariations(newIds);
                              }}
                              className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-goose-text flex-1">{vt.name}</span>
                            <span className="text-xs text-goose-text-light">
                              {vt.options.map(o => typeof o === 'object' && o !== null ? (o as any).label ?? (o as any).name ?? (o as any).value ?? JSON.stringify(o) : String(o)).join(', ')}
                            </span>
                          </label>
                        ))}
                      </div>

                      {configuredTypeIds.length > 0 && (
                        <div className="mt-3 flex items-center gap-3">
                          <Field label="Stock mode">
                            <select value={stockMode} onChange={(e) => setStockMode(e.target.value as any)} className="input text-xs">
                              <option value="variation">Per variation</option>
                              <option value="parent">Parent product</option>
                            </select>
                          </Field>
                          <button
                            type="button"
                            onClick={handleGenerateVariations}
                            disabled={saving}
                            className="mt-5 px-3 py-2 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {saving && <LoadingSpinner size="sm" />}
                            Auto-generate
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Variations list */}
                {variations.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-goose-text mb-2">
                      Variations ({variations.length})
                    </h3>
                    <div className="space-y-2">
                      {variations.map(v => (
                        <VariationRow
                          key={v.id}
                          variation={v}
                          onUpdate={handleUpdateVariation}
                          onDelete={handleDeleteVariation}
                          saving={saving}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Actions (always visible) */}
      <div className="flex gap-3 pt-4 mt-4 border-t border-goose-border">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <LoadingSpinner size="sm" />}
          {isEdit ? 'Update Product' : 'Create Product'}
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

function VariationRow({
  variation,
  onUpdate,
  onDelete,
  saving,
}: {
  variation: ProductVariation;
  onUpdate: (id: number, updates: Record<string, unknown>) => void;
  onDelete: (id: number) => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [varPrice, setVarPrice] = useState(variation.price != null ? String(variation.price) : '');
  const [varSalePrice, setVarSalePrice] = useState(variation.sale_price != null ? String(variation.sale_price) : '');
  const [varStock, setVarStock] = useState(variation.stock != null ? String(variation.stock) : '');
  const [varSku, setVarSku] = useState(variation.sku ?? '');

  const attrLabel = variation.attributes.map(a => a.value).join(' / ');

  if (!editing) {
    return (
      <div className="border border-goose-border rounded-lg px-3 py-2 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-goose-text truncate">{attrLabel}</p>
          <p className="text-xs text-goose-text-light">
            {variation.sku && `${variation.sku} · `}
            {variation.price != null ? `$${variation.price}` : 'No price'}
            {variation.sale_price != null && ` (sale: $${variation.sale_price})`}
            {' · '}Stock: {variation.stock ?? 'N/A'}
          </p>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
          variation.status === 'active' ? 'bg-primary-50 text-primary-700' : 'bg-gray-100 text-goose-text-light'
        }`}>
          {variation.status}
        </span>
        {variation.is_default && (
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-600">Default</span>
        )}
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="p-1 text-goose-text-light hover:text-primary-600 transition-colors"
          title="Edit"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="border border-primary-200 rounded-lg p-3 space-y-2 bg-primary-50/30">
      <p className="text-sm font-medium text-goose-text">{attrLabel}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-goose-text-light">SKU</label>
          <input type="text" value={varSku} onChange={(e) => setVarSku(e.target.value)} className="input text-xs" />
        </div>
        <div>
          <label className="text-xs text-goose-text-light">Price</label>
          <input type="number" step="0.01" min="0" value={varPrice} onChange={(e) => setVarPrice(e.target.value)} className="input text-xs" />
        </div>
        <div>
          <label className="text-xs text-goose-text-light">Sale Price</label>
          <input type="number" step="0.01" min="0" value={varSalePrice} onChange={(e) => setVarSalePrice(e.target.value)} className="input text-xs" />
        </div>
        <div>
          <label className="text-xs text-goose-text-light">Stock</label>
          <input type="number" min="0" value={varStock} onChange={(e) => setVarStock(e.target.value)} className="input text-xs" />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            const updates: Record<string, unknown> = {};
            if (varSku !== (variation.sku ?? '')) updates.sku = varSku;
            if (varPrice) updates.price = parseFloat(varPrice);
            if (varSalePrice) updates.sale_price = parseFloat(varSalePrice);
            if (varStock) updates.stock = parseInt(varStock, 10);
            onUpdate(variation.id, updates);
            setEditing(false);
          }}
          className="px-3 py-1 text-xs font-medium text-white bg-primary-600 rounded hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="px-3 py-1 text-xs font-medium text-goose-text bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => onDelete(variation.id)}
          className="px-3 py-1 text-xs font-medium text-red-600 bg-red-50 rounded hover:bg-red-100 transition-colors disabled:opacity-50 ml-auto"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AttributeField({
  attribute,
  value,
  onChange,
}: {
  attribute: ProductAttribute;
  value: string | number;
  onChange: (val: string | number) => void;
}) {
  const label = attribute.name + (attribute.unit ? ` (${attribute.unit})` : '');

  if (attribute.attribute_type === 'select' && attribute.options && attribute.options.length > 0) {
    return (
      <Field label={label}>
        <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
          <option value="">— Select —</option>
          {attribute.options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </Field>
    );
  }

  if (attribute.attribute_type === 'number') {
    return (
      <Field label={label}>
        <input
          type="number"
          step="any"
          value={value}
          onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : '')}
          className="input"
        />
      </Field>
    );
  }

  return (
    <Field label={label}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
      />
    </Field>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-goose-text mb-1">{label}</label>
      {children}
    </div>
  );
}
