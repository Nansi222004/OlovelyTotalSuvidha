import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { uploadImage, uploadImages } from "../../../services/api/uploadService";
import {
  validateImageFile,
  createImagePreview,
  compressImage,
} from "../../../utils/imageUpload";
import {
  getProductById,
  updateProduct,
  createProduct,
  getCategories,
  getBrands,
  getSellers,
  generateProductBarcode,
  type Category,
  type Brand,
  type Seller,
} from "../../../services/api/admin/adminProductService";
import { resolveImageUrl } from "../../../utils/imageUrl";
import { getHeaderCategoriesAdmin, type HeaderCategory } from "../../../services/api/headerCategoryService";
import { getSubcategories, getSubSubCategories, type SubCategory, type SubSubCategory } from "../../../services/api/categoryService";
import { getTaxes, type Tax } from "../../../services/api/admin/adminTaxService";
import { getShopByStores, type ShopByStore } from "../../../services/api/admin/adminMiscService";
import { useToast } from "../../../context/ToastContext";
import { useAppSettings } from "../../../context/AppSettingsContext";
import { BarcodeGraphic, printBarcodeLabel } from "../components/BarcodeLabel";

interface VariationItem {
  _id?: string;
  name?: string;
  value?: string;
  title?: string;
  price: number;
  discPrice: number;
  stock: number;
  status: "Available" | "Sold out" | "In stock";
  sku?: string;
  barcode?: string;
}

export default function AdminProductEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isAddMode = !id || id === "add" || id === "new";
  const { showToast } = useToast();
  const { settings: appSettings } = useAppSettings();
  const productFormRef = useRef<HTMLFormElement>(null);
  const generateAfterCreateRef = useRef<"product" | number | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string>("");
  const [sellerInfo, setSellerInfo] = useState<{ name: string; store: string; isPlatform?: boolean } | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);

  const [formData, setFormData] = useState({
    sellerId: "admin",
    productName: "",
    headerCategory: "",
    category: "",
    subcategory: "",
    subSubCategory: "",
    publish: "Yes",
    popular: "No",
    dealOfDay: "No",
    brand: "",
    sku: "",
    barcode: "",
    wholesaleEnabled: "No",
    wholesalePrice: "",
    wholesaleMinimumQuantity: "",
    smallDescription: "",
    seoTitle: "",
    seoKeywords: "",
    seoImageAlt: "",
    seoDescription: "",
    variationType: "",
    manufacturer: "",
    madeIn: "",
    tax: "",
    hsnCode: "",
    isReturnable: "No",
    maxReturnDays: "",
    fssaiLicNo: "",
    totalAllowedQuantity: "10",
    mainImageUrl: "",
    galleryImageUrls: [] as string[],
    isShopByStoreOnly: "No",
    shopId: "",
  });

  const [variations, setVariations] = useState<VariationItem[]>([]);
  const [variationForm, setVariationForm] = useState({
    title: "",
    price: "",
    discPrice: "0",
    stock: "0",
    status: "Available" as "Available" | "Sold out",
    sku: "",
    barcode: "",
  });

  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [mainImagePreview, setMainImagePreview] = useState<string>("");
  const [galleryImageFiles, setGalleryImageFiles] = useState<File[]>([]);
  const [galleryImagePreviews, setGalleryImagePreviews] = useState<string[]>([]);

  const [headerCategories, setHeaderCategories] = useState<HeaderCategory[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<SubCategory[]>([]);
  const [subSubCategories, setSubSubCategories] = useState<SubSubCategory[]>([]);
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [shops, setShops] = useState<ShopByStore[]>([]);

  // 1. Initial dropdown master data loading
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [
          hcRes,
          catsRes,
          taxesRes,
          brandsRes,
          shopsRes,
          sellersRes,
        ] = await Promise.allSettled([
          getHeaderCategoriesAdmin(),
          getCategories(),
          getTaxes(),
          getBrands(),
          getShopByStores(),
          getSellers(),
        ]);

        if (hcRes.status === "fulfilled" && Array.isArray(hcRes.value)) {
          setHeaderCategories(hcRes.value);
        }

        if (catsRes.status === "fulfilled" && catsRes.value.success && Array.isArray(catsRes.value.data)) {
          setCategories(catsRes.value.data);
        }

        if (taxesRes.status === "fulfilled" && taxesRes.value.success && Array.isArray(taxesRes.value.data)) {
          setTaxes(taxesRes.value.data.filter((t) => t.status === "Active"));
        }

        if (brandsRes.status === "fulfilled" && brandsRes.value.success && Array.isArray(brandsRes.value.data)) {
          setBrands(brandsRes.value.data);
        }

        if (shopsRes.status === "fulfilled" && shopsRes.value.success && Array.isArray(shopsRes.value.data)) {
          setShops(shopsRes.value.data);
        }

        if (sellersRes.status === "fulfilled" && sellersRes.value.success && Array.isArray(sellersRes.value.data)) {
          setSellers(sellersRes.value.data);
        }
      } catch (err) {
        console.error("Error loading master dropdowns:", err);
      }
    };

    fetchMasterData();
  }, []);

  // 2. Load product details by ID (in edit mode)
  useEffect(() => {
    if (isAddMode) {
      setLoading(false);
      return;
    }

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setUploadError("");
        const response = await getProductById(id!);

        if (response.success && response.data) {
          const product: any = response.data;

          let isPlatform = false;
          // Extract seller info
          if (product.seller && typeof product.seller === "object") {
            isPlatform =
              product.ownerType === "PLATFORM" ||
              product.seller.isPlatform ||
              product.seller.category === "Admin" ||
              product.seller.email === "admin-store@olovely.com" ||
              product.seller.sellerName === "Olovely Admin" ||
              product.seller.storeName === "Olovely Admin Store";

            setSellerInfo({
              name: isPlatform ? "Admin / Platform Inventory" : (product.seller.sellerName || "N/A"),
              store: isPlatform ? "Admin Store" : (product.seller.storeName || "N/A"),
              isPlatform,
            });
            setFormData((prev) => ({
              ...prev,
              sellerId: isPlatform ? "admin" : (product.seller._id || ""),
            }));
          }

          const headerCatId =
            product.headerCategoryId?._id ||
            product.headerCategoryId ||
            (product.category?.headerCategoryId?._id || product.category?.headerCategoryId) ||
            "";

          const categoryId =
            product.category?._id ||
            product.category ||
            product.categoryId ||
            "";

          const subcatId =
            product.subcategory?._id ||
            product.subcategory ||
            product.subcategoryId ||
            "";

          const subSubCatId =
            product.subSubCategory?._id ||
            product.subSubCategory ||
            product.subSubCategoryId ||
            "";

          const brandId =
            product.brand?._id ||
            product.brand ||
            product.brandId ||
            "";

          const taxId =
            product.tax?._id ||
            product.tax ||
            product.taxId ||
            "";

          const shopIdVal =
            product.shopId?._id ||
            product.shopId ||
            "";

          setFormData({
            sellerId: isPlatform ? "admin" : (product.seller?._id || product.seller || ""),
            productName: product.productName || "",
            headerCategory: headerCatId,
            category: categoryId,
            subcategory: subcatId,
            subSubCategory: subSubCatId,
            publish: product.publish ? "Yes" : "No",
            popular: product.popular ? "Yes" : "No",
            dealOfDay: product.dealOfDay ? "Yes" : "No",
            brand: brandId,
            sku: product.sku || "",
            barcode: product.barcode || "",
            wholesaleEnabled: product.wholesaleEnabled ? "Yes" : "No",
            wholesalePrice: product.wholesalePrice?.toString() || "",
            wholesaleMinimumQuantity: product.wholesaleMinimumQuantity?.toString() || "",
            smallDescription: product.smallDescription || "",
            seoTitle: product.seoTitle || "",
            seoKeywords: product.seoKeywords || "",
            seoImageAlt: product.seoImageAlt || "",
            seoDescription: product.seoDescription || "",
            variationType: product.variationType || "",
            manufacturer: product.manufacturer || "",
            madeIn: product.madeIn || "",
            tax: taxId,
            hsnCode: product.hsnCode || "",
            isReturnable: product.isReturnable ? "Yes" : "No",
            maxReturnDays: product.maxReturnDays?.toString() || "",
            fssaiLicNo: product.fssaiLicNo || "",
            totalAllowedQuantity: product.totalAllowedQuantity?.toString() || "10",
            mainImageUrl: product.mainImage || product.mainImageUrl || "",
            galleryImageUrls: product.galleryImages || product.galleryImageUrls || [],
            isShopByStoreOnly: product.isShopByStoreOnly ? "Yes" : "No",
            shopId: shopIdVal,
          });

          // Preload main image preview
          if (product.mainImage || product.mainImageUrl) {
            setMainImagePreview(resolveImageUrl(product.mainImage || product.mainImageUrl));
          }

          // Preload gallery previews
          const rawGallery = product.galleryImages || product.galleryImageUrls || [];
          if (rawGallery.length > 0) {
            setGalleryImagePreviews(rawGallery.map((img: string) => resolveImageUrl(img)));
          }

          // Preload variations
          if (Array.isArray(product.variations) && product.variations.length > 0) {
            setVariations(
              product.variations.map((v: any) => ({
                _id: v._id,
                title: v.value || v.name || v.title || "Default",
                value: v.value || v.name || v.title || "Default",
                price: Number(v.price) || 0,
                discPrice: Number(v.discPrice) || 0,
                stock: Number(v.stock) || 0,
                status: v.status || (v.stock > 0 ? "Available" : "Sold out"),
                sku: v.sku || "",
                barcode: v.barcode || "",
              }))
            );
          } else if (product.price !== undefined) {
            setVariations([
              {
                title: "Default",
                value: "Default",
                price: Number(product.price) || 0,
                discPrice: Number(product.discPrice) || 0,
                stock: Number(product.stock) || 0,
                status: "Available",
              },
            ]);
          }

          // Load subcategories for the product's category
          if (categoryId) {
            try {
              const subRes = await getSubcategories(categoryId);
              if (subRes.success) {
                setSubcategories(subRes.data);
              }
            } catch (e) {
              console.error("Error loading subcategories:", e);
            }
          }

          // Load sub-subcategories if subcat exists
          if (subcatId) {
            try {
              const subSubRes = await getSubSubCategories(subcatId);
              if (subSubRes.success) {
                setSubSubCategories(subSubRes.data);
              }
            } catch (e) {
              console.error("Error loading sub-subcategories:", e);
            }
          }
        } else {
          setUploadError(response.message || "Failed to load product details");
        }
      } catch (err: any) {
        console.error("Error fetching product:", err);
        setUploadError(err.response?.data?.message || "Failed to load product details");
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  // Dynamic filter for Categories based on selected Header Category
  const filteredCategories = useMemo(() => {
    // Only consider root categories (categories without a parentId)
    const rootCategories = categories.filter((cat) => !cat.parentId);

    if (!formData.headerCategory) {
      return rootCategories;
    }

    const selectedHeaderCat = headerCategories.find(
      (hc) => hc._id === formData.headerCategory || (hc as any).id === formData.headerCategory
    );

    // If "All" is selected as header category, show all root categories
    if (selectedHeaderCat && selectedHeaderCat.name.toLowerCase() === "all") {
      return rootCategories;
    }

    // Filter categories that match the selected header category
    const matching = rootCategories.filter((cat: any) => {
      const hcId =
        typeof cat.headerCategoryId === "string"
          ? cat.headerCategoryId
          : cat.headerCategoryId?._id || (cat as any).headerCategory?._id;
      return hcId === formData.headerCategory;
    });

    // If categories match the specific header category, return them
    if (matching.length > 0) {
      return matching;
    }

    // Fallback: If no categories are tagged specifically to this header category,
    // show all root categories so admin is never blocked
    return rootCategories;
  }, [categories, headerCategories, formData.headerCategory]);

  // Load subcategories when category changes
  useEffect(() => {
    if (!formData.category) {
      setSubcategories([]);
      return;
    }
    const fetchSubcategories = async () => {
      try {
        const res = await getSubcategories(formData.category);
        if (res.success) {
          setSubcategories(res.data);
        }
      } catch (err) {
        console.error("Error fetching subcategories:", err);
      }
    };
    fetchSubcategories();
  }, [formData.category]);

  // Load sub-subcategories when subcategory changes
  useEffect(() => {
    if (!formData.subcategory) {
      setSubSubCategories([]);
      return;
    }
    const fetchSubSub = async () => {
      try {
        const res = await getSubSubCategories(formData.subcategory);
        if (res.success) {
          setSubSubCategories(res.data);
        }
      } catch (err) {
        console.error("Error fetching sub-subcategories:", err);
      }
    };
    fetchSubSub();
  }, [formData.subcategory]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleHeaderCategoryChange = (headerCatId: string) => {
    setFormData((prev) => {
      // Check if current category belongs to this new header category
      const currentCat = categories.find((c) => c._id === prev.category);
      let keepCategory = false;

      if (currentCat) {
        const selectedHc = headerCategories.find((h) => h._id === headerCatId);
        if (!headerCatId || (selectedHc && selectedHc.name.toLowerCase() === "all")) {
          keepCategory = true;
        } else {
          const catHc = currentCat.headerCategoryId as any;
          const catHcId =
            typeof catHc === "string"
              ? catHc
              : catHc?._id || currentCat.headerCategory?._id;
          keepCategory = catHcId === headerCatId;
        }
      }

      return {
        ...prev,
        headerCategory: headerCatId,
        category: keepCategory ? prev.category : "",
        subcategory: keepCategory ? prev.subcategory : "",
        subSubCategory: keepCategory ? prev.subSubCategory : "",
      };
    });
  };

  const handleCategoryChange = (categoryId: string) => {
    const selectedCat = categories.find((c) => c._id === categoryId);
    setFormData((prev) => {
      let headerCatId = prev.headerCategory;
      // If no header category was selected, or "All" was selected, auto-set from category
      if (selectedCat && (!headerCatId || headerCatId === "")) {
        const catHc = selectedCat.headerCategoryId as any;
        const catHcId =
          typeof catHc === "string"
            ? catHc
            : catHc?._id || selectedCat.headerCategory?._id;
        if (catHcId) {
          headerCatId = catHcId;
        }
      }
      return {
        ...prev,
        category: categoryId,
        subcategory: "",
        subSubCategory: "",
        headerCategory: headerCatId,
      };
    });
  };

  const handleMainImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      setUploadError(validation.error || "Invalid image file");
      return;
    }

    setMainImageFile(file);
    setUploadError("");

    try {
      const preview = await createImagePreview(file);
      setMainImagePreview(preview);
    } catch (error) {
      setUploadError("Failed to create image preview");
    }
  };

  const handleGalleryImagesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const invalidFiles = files.filter((file) => !validateImageFile(file).valid);
    if (invalidFiles.length > 0) {
      setUploadError("Some files are invalid. Please check file types and sizes.");
      return;
    }

    setGalleryImageFiles((prev) => [...prev, ...files]);
    setUploadError("");

    try {
      const newPreviews = await Promise.all(files.map((file) => createImagePreview(file)));
      setGalleryImagePreviews((prev) => [...prev, ...newPreviews]);
    } catch (error) {
      setUploadError("Failed to create image previews");
    }

    e.target.value = "";
  };

  const removeGalleryImage = (index: number) => {
    const existingCount = formData.galleryImageUrls.length;
    if (index < existingCount) {
      setFormData((prev) => ({
        ...prev,
        galleryImageUrls: prev.galleryImageUrls.filter((_, i) => i !== index),
      }));
    } else {
      const fileIndex = index - existingCount;
      setGalleryImageFiles((prev) => prev.filter((_, i) => i !== fileIndex));
    }
    setGalleryImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const minRetailPrice = useMemo(() => {
    if (!variations || variations.length === 0) return 0;
    const prices = variations.map((v) => (v.discPrice > 0 ? v.discPrice : v.price)).filter((p) => p > 0);
    return prices.length > 0 ? Math.min(...prices) : 0;
  }, [variations]);

  const selectedCategoryObj = useMemo(() => {
    return categories.find((c) => c._id === formData.category);
  }, [categories, formData.category]);

  const addVariation = () => {
    if (!variationForm.title || !variationForm.price) {
      setUploadError("Please fill in variation title and price");
      return;
    }

    const price = parseFloat(variationForm.price);
    const discPrice = parseFloat(variationForm.discPrice || "0");
    const stock = parseInt(variationForm.stock || "0", 10);

    if (discPrice > price) {
      setUploadError("Discounted price cannot be greater than regular price");
      return;
    }

    const newVariation: VariationItem = {
      title: variationForm.title,
      value: variationForm.title,
      price,
      discPrice,
      stock,
      status: variationForm.status,
      sku: variationForm.sku?.trim() || undefined,
      barcode: variationForm.barcode?.trim() || undefined,
    };

    setVariations((prev) => [...prev, newVariation]);
    setVariationForm({
      title: "",
      price: "",
      discPrice: "0",
      stock: "0",
      status: "Available",
      sku: "",
      barcode: "",
    });
    setUploadError("");
  };

  const removeVariation = (index: number) => {
    setVariations((prev) => prev.filter((_, i) => i !== index));
  };

  const generateAndSaveBarcode = async (variationIndex?: number) => {
    if (isAddMode || !id) {
      generateAfterCreateRef.current = variationIndex === undefined ? "product" : variationIndex;
      setUploadError("Complete the required product fields. Generate Barcode will create the product and persist the generated code.");
      productFormRef.current?.requestSubmit();
      return;
    }
    const variation = variationIndex === undefined ? undefined : variations[variationIndex];
    if (variationIndex !== undefined && !variation?._id) {
      setUploadError("Save this new variation first, then generate its persisted barcode.");
      return;
    }
    const existingBarcode = variationIndex === undefined ? formData.barcode : variation?.barcode;
    if (existingBarcode && !window.confirm(`Replace saved barcode ${existingBarcode} with a newly generated barcode?`)) {
      return;
    }
    try {
      const response = await generateProductBarcode(id, variation?._id);
      const barcode = response.data?.barcode;
      if (!barcode) throw new Error("Barcode generation returned no value");
      if (variationIndex === undefined) {
        setFormData((previous) => ({ ...previous, barcode }));
      } else {
        setVariations((previous) => previous.map((item, index) => index === variationIndex ? { ...item, barcode } : item));
      }
      setUploadError("");
      showToast("Barcode generated and saved.", "success");
    } catch (error: any) {
      setUploadError(error?.response?.data?.message || error?.message || "Unable to generate barcode");
    }
  };

  const copyBarcode = async (barcode: string) => {
    await navigator.clipboard.writeText(barcode);
    showToast("Barcode copied.", "success");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAddMode && !id) return;

    setUploadError("");

    if (!formData.productName.trim()) {
      setUploadError("Please enter a product name.");
      return;
    }

    if (formData.isShopByStoreOnly !== "Yes") {
      if (!formData.headerCategory) {
        setUploadError("Please select a header category.");
        return;
      }
      if (!formData.category) {
        setUploadError("Please select a category.");
        return;
      }
    }

    if (variations.length === 0) {
      setUploadError("Please add at least one product variation with a price.");
      return;
    }

    if (formData.wholesaleEnabled === "Yes") {
      const wp = parseFloat(formData.wholesalePrice || "0");
      const moq = parseInt(formData.wholesaleMinimumQuantity || "0", 10);
      if (!wp || wp <= 0) {
        setUploadError("Wholesale price must be greater than 0 when wholesale is enabled.");
        return;
      }
      if (minRetailPrice > 0 && wp >= minRetailPrice) {
        setUploadError(`Wholesale price (₹${wp}) must be strictly less than the lowest retail price (₹${minRetailPrice}).`);
        return;
      }
      if (!moq || moq < 1) {
        setUploadError("Wholesale Minimum Order Quantity (MOQ) must be at least 1.");
        return;
      }
    }

    setSubmitting(true);

    try {
      let mainImageUrl = formData.mainImageUrl;
      let galleryImageUrls = [...formData.galleryImageUrls];

      // Upload main image if a new one was selected
      if (mainImageFile) {
        const compressedMainImage = await compressImage(mainImageFile);
        const mainImageResult = await uploadImage(compressedMainImage, "olovely/products");
        mainImageUrl = mainImageResult.secureUrl;
      }

      // Upload newly added gallery images
      if (galleryImageFiles.length > 0) {
        const compressedGalleryFiles = await Promise.all(
          galleryImageFiles.map((file) => compressImage(file))
        );
        const galleryResults = await uploadImages(compressedGalleryFiles, "olovely/products/gallery");
        const newUrls = galleryResults.map((res) => res.secureUrl);
        galleryImageUrls = [...galleryImageUrls, ...newUrls];
      }

      const productPayload: any = {
        productName: formData.productName,
        headerCategoryId: formData.headerCategory || null,
        categoryId: formData.category || null,
        subcategoryId: formData.subcategory || null,
        subSubCategoryId: formData.subSubCategory || null,
        brandId: formData.brand || null,
        sku: formData.sku.trim() || undefined,
        publish: formData.publish === "Yes",
        popular: formData.popular === "Yes",
        dealOfDay: formData.dealOfDay === "Yes",
        barcode: formData.barcode ? formData.barcode.trim() : undefined,
        wholesaleEnabled: formData.wholesaleEnabled === "Yes",
        wholesalePrice: formData.wholesaleEnabled === "Yes" && formData.wholesalePrice ? parseFloat(formData.wholesalePrice) : undefined,
        wholesaleMinimumQuantity: formData.wholesaleEnabled === "Yes" && formData.wholesaleMinimumQuantity ? parseInt(formData.wholesaleMinimumQuantity, 10) : undefined,
        seoTitle: formData.seoTitle || "",
        seoKeywords: formData.seoKeywords || "",
        seoImageAlt: formData.seoImageAlt || "",
        seoDescription: formData.seoDescription || "",
        smallDescription: formData.smallDescription || "",
        manufacturer: formData.manufacturer || "",
        madeIn: formData.madeIn || "",
        taxId: formData.tax || null,
        hsnCode: formData.hsnCode.trim() || undefined,
        isReturnable: formData.isReturnable === "Yes",
        maxReturnDays: formData.maxReturnDays ? parseInt(formData.maxReturnDays, 10) : undefined,
        totalAllowedQuantity: parseInt(formData.totalAllowedQuantity || "10", 10),
        fssaiLicNo: formData.fssaiLicNo || "",
        mainImage: mainImageUrl || undefined,
        mainImageUrl: mainImageUrl || undefined,
        galleryImages: galleryImageUrls,
        galleryImageUrls: galleryImageUrls,
        price: variations[0]?.price || 0,
        category: formData.category || undefined,
        variations: variations.map((v) => ({
          name: v.name || "Variation",
          value: v.value || v.title || "Default",
          title: v.title || v.value || "Default",
          price: v.price,
          discPrice: v.discPrice || 0,
          stock: v.stock || 0,
          status: v.status || "Available",
          sku: v.sku ? v.sku.trim() : undefined,
          barcode: v.barcode ? v.barcode.trim() : undefined,
        })),
        variationType: formData.variationType || undefined,
        isShopByStoreOnly: formData.isShopByStoreOnly === "Yes",
        shopId: formData.isShopByStoreOnly === "Yes" && formData.shopId ? formData.shopId : null,
        sellerId: formData.sellerId === "admin" || !formData.sellerId ? "admin" : formData.sellerId,
      };

      const res = isAddMode
        ? await createProduct(productPayload)
        : await updateProduct(id!, productPayload);

      if (res.success) {
        if (isAddMode && generateAfterCreateRef.current !== null && res.data?._id) {
          const target = generateAfterCreateRef.current;
          const variationId = typeof target === "number" ? res.data.variations?.[target]?._id : undefined;
          if (typeof target !== "number" || variationId) {
            try {
              await generateProductBarcode(res.data._id, variationId);
              showToast("Product created and barcode generated and saved.", "success");
            } catch (generationError: any) {
              showToast(generationError?.response?.data?.message || "Product was created, but barcode generation failed. Retry from the edit screen.", "error");
            } finally {
              generateAfterCreateRef.current = null;
              navigate(`/admin/product/edit/${res.data._id}`);
            }
            return;
          }
        }
        showToast(
          isAddMode
            ? "Product and images created successfully!"
            : "Product and images updated successfully!",
          "success"
        );
        navigate("/admin/product/list");
      } else {
        setUploadError(res.message || "Failed to save product");
      }
    } catch (err: any) {
      console.error("Error saving product:", err);
      setUploadError(
        err.response?.data?.message || err.message || "An error occurred while saving the product"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-sm text-neutral-600 font-medium">Loading product details...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 pb-12">
      {/* Top Bar with Navigation */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/product/list")}
            className="p-2 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-100 text-neutral-700 transition-colors shadow-sm"
            title="Back to Product List">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-neutral-800">
              {isAddMode ? "Add New Product" : "Edit Product"}
            </h1>
            <p className="text-xs text-neutral-500">
              {isAddMode ? (
                "Create a new product with images, pricing, and variations"
              ) : (
                <>Update details for product ID: <span className="font-mono text-neutral-700">{id}</span></>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {sellerInfo && (
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              sellerInfo.isPlatform
                ? "bg-purple-50 border-purple-200 text-purple-800"
                : "bg-teal-50 border-teal-200 text-teal-800"
            }`}>
              <span>Store: <strong>{sellerInfo.store}</strong></span>
              <span>•</span>
              <span>Owner: <strong>{sellerInfo.name}</strong></span>
            </div>
          )}
          <Link
            to="/admin/product/list"
            className="px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm text-neutral-700 hover:bg-neutral-100 font-medium transition-colors shadow-sm">
            Cancel
          </Link>
        </div>
      </div>

      {uploadError && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center justify-between text-sm">
          <span>{uploadError}</span>
          <button
            type="button"
            onClick={() => setUploadError("")}
            className="text-red-500 hover:text-red-700 font-bold ml-4">
            ×
          </button>
        </div>
      )}

      <form ref={productFormRef} onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Product Info */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">Basic Product Details</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Product Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="productName"
                  value={formData.productName}
                  onChange={handleChange}
                  placeholder="Enter Product Name"
                  required
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Product Ownership / Seller <span className="text-red-500">*</span>
                </label>
                <select
                  name="sellerId"
                  value={formData.sellerId || "admin"}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="admin">🏢 Admin / Platform Inventory (Canonical Platform Store)</option>
                  {sellers
                    .filter((s) => !s.isPlatform && s.sellerName !== "Olovely Admin")
                    .map((s) => (
                      <option key={s._id} value={s._id}>
                        🏪 {s.storeName || s.sellerName} ({s.sellerName} - {s.email})
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-neutral-500">
                  Select "Admin / Platform Inventory" for central inventory or assign to an authentic vendor.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Select Header Category <span className="text-red-500">*</span>
                </label>
                <select
                  name="headerCategory"
                  value={formData.headerCategory}
                  onChange={(e) => handleHeaderCategoryChange(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="">All Header Categories</option>
                  {headerCategories.map((hc) => (
                    <option key={hc._id || (hc as any).id} value={hc._id || (hc as any).id}>
                      {hc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-neutral-700">
                    Select Category <span className="text-red-500">*</span>
                  </label>
                  <span className="text-xs text-neutral-400">
                    {filteredCategories.length} categories
                  </span>
                </div>
                <select
                  name="category"
                  value={formData.category}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="">Select Category</option>
                  {filteredCategories.map((cat) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Select SubCategory
                </label>
                <select
                  name="subcategory"
                  value={formData.subcategory}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="">
                    {!formData.category
                      ? "Select Category First"
                      : subcategories.length === 0
                      ? "No subcategories found"
                      : "Select Subcategory"}
                  </option>
                  {subcategories.map((sub) => (
                    <option key={sub._id || (sub as any).id} value={sub._id || (sub as any).id}>
                      {sub.subcategoryName || (sub as any).name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Select Sub-SubCategory
                </label>
                <select
                  name="subSubCategory"
                  value={formData.subSubCategory}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="">
                    {!formData.subcategory
                      ? "Select Subcategory First"
                      : subSubCategories.length === 0
                      ? "No sub-subcategories found"
                      : "Select Sub-SubCategory"}
                  </option>
                  {subSubCategories.map((subSub) => (
                    <option key={subSub._id} value={subSub._id}>
                      {subSub.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Publish Status
                </label>
                <select
                  name="publish"
                  value={formData.publish}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="Yes">Yes (Published)</option>
                  <option value="No">No (Unpublished)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Make Product Popular?
                </label>
                <select
                  name="popular"
                  value={formData.popular}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Deal of the Day?
                </label>
                <select
                  name="dealOfDay"
                  value={formData.dealOfDay}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Select Brand <span className="text-xs text-neutral-400 font-normal">(Optional)</span>
                </label>
                <select
                  name="brand"
                  value={formData.brand}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white">
                  <option value="">Select Brand</option>
                  {brands.map((brand) => (
                    <option key={brand._id} value={brand._id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Product SKU <span className="text-xs text-neutral-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  placeholder="e.g. SALT-001"
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Product Barcode / EAN / UPC <span className="text-xs text-neutral-400 font-normal">(Optional)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleChange}
                    placeholder="e.g. 8901234567890"
                    className="min-w-0 flex-1 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 font-mono text-sm"
                  />
                  <button type="button" onClick={() => generateAndSaveBarcode()} className="px-3 py-2 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700">
                    Generate Barcode
                  </button>
                </div>
                {formData.barcode && (
                  <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-3">
                    <BarcodeGraphic value={formData.barcode} height={52} />
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="font-mono text-xs break-all">{formData.barcode}</span>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => copyBarcode(formData.barcode)} className="text-xs text-teal-700 font-semibold">Copy</button>
                        <button type="button" onClick={() => printBarcodeLabel({ productName: formData.productName || "Product", sku: formData.sku, barcode: formData.barcode })} className="text-xs text-teal-700 font-semibold">Print Label</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Product Small Description
              </label>
              <textarea
                name="smallDescription"
                value={formData.smallDescription}
                onChange={handleChange}
                placeholder="Enter Product Small Description"
                rows={3}
                className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Wholesale Configuration Card */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-gradient-to-r from-teal-700 to-teal-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🏷️</span>
              <h2 className="text-base sm:text-lg font-semibold">Wholesale Configuration</h2>
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${formData.wholesaleEnabled === "Yes" ? "bg-teal-300 text-teal-950 font-bold" : "bg-neutral-600 text-neutral-200"}`}>
              {formData.wholesaleEnabled === "Yes" ? "Wholesale Enabled" : "Wholesale Disabled"}
            </span>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            {/* Eligibility notices */}
            <div className="space-y-2">
              {appSettings.wholesaleSettings?.wholesaleEnabled === false && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                  <span>⚠️</span>
                  <span><strong>Global Wholesale Disabled:</strong> Wholesale is currently disabled in Global Wholesale Settings. Products will not be purchasable at wholesale prices by customers until global wholesale is re-enabled.</span>
                </div>
              )}
              {formData.category && selectedCategoryObj && selectedCategoryObj.wholesaleEnabled === false && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                  <span>⚠️</span>
                  <span><strong>Category Wholesale Inactive:</strong> The category &ldquo;{selectedCategoryObj.name}&rdquo; has wholesale disabled. This product will not be eligible for wholesale orders until category wholesale is enabled.</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Enable Wholesale for this Product?
                </label>
                <select
                  name="wholesaleEnabled"
                  value={formData.wholesaleEnabled}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                  <option value="No">No (Retail Only)</option>
                  <option value="Yes">Yes (Wholesale Available)</option>
                </select>
              </div>

              {formData.wholesaleEnabled === "Yes" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Wholesale Unit Price (₹) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      name="wholesalePrice"
                      value={formData.wholesalePrice}
                      onChange={handleChange}
                      placeholder="e.g. 150"
                      required={formData.wholesaleEnabled === "Yes"}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    {minRetailPrice > 0 && (
                      <p className="text-xs text-neutral-500 mt-1">
                        Must be strictly less than retail price (Lowest Retail: ₹{minRetailPrice})
                      </p>
                    )}
                    {formData.wholesalePrice && minRetailPrice > 0 && parseFloat(formData.wholesalePrice) >= minRetailPrice && (
                      <p className="text-xs text-red-600 font-semibold mt-1">
                        ⚠️ Wholesale price (₹{formData.wholesalePrice}) must be strictly less than retail price (₹{minRetailPrice}).
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Wholesale Minimum Order Qty (MOQ) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      name="wholesaleMinimumQuantity"
                      value={formData.wholesaleMinimumQuantity}
                      onChange={handleChange}
                      placeholder={appSettings.wholesaleSettings?.defaultWholesaleMinimumQuantity?.toString() || "10"}
                      required={formData.wholesaleEnabled === "Yes"}
                      className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                    <p className="text-xs text-neutral-500 mt-1">
                      Minimum units per order (Global default: {appSettings.wholesaleSettings?.defaultWholesaleMinimumQuantity || 10})
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Product Variations */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">Product Variations & Pricing</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Variation Type (e.g. Size, Weight, Color, Pack)
              </label>
              <select
                name="variationType"
                value={formData.variationType}
                onChange={handleChange}
                className="w-full md:w-1/3 px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                <option value="">Select Variation Type</option>
                <option value="Weight">Weight (e.g. 500g, 1kg)</option>
                <option value="Size">Size (e.g. S, M, L, XL)</option>
                <option value="Color">Color (e.g. Red, Blue)</option>
                <option value="Pack">Pack (e.g. Pack of 2, 500ml)</option>
              </select>
            </div>

            {/* Add Variation Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 p-4 bg-neutral-50 border border-neutral-200 rounded-lg">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Title (e.g., 500g, Large) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={variationForm.title}
                  onChange={(e) => setVariationForm({ ...variationForm, title: e.target.value })}
                  placeholder="500g"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Price (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={variationForm.price}
                  onChange={(e) => setVariationForm({ ...variationForm, price: e.target.value })}
                  placeholder="100"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Discount Price (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={variationForm.discPrice}
                  onChange={(e) => setVariationForm({ ...variationForm, discPrice: e.target.value })}
                  placeholder="80"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Stock (0 = Unlimited)
                </label>
                <input
                  type="number"
                  min="0"
                  value={variationForm.stock}
                  onChange={(e) => setVariationForm({ ...variationForm, stock: e.target.value })}
                  placeholder="0"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  SKU (Optional)
                </label>
                <input
                  type="text"
                  value={variationForm.sku}
                  onChange={(e) => setVariationForm({ ...variationForm, sku: e.target.value })}
                  placeholder="SALT-1KG"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Barcode (Optional)
                </label>
                <input
                  type="text"
                  value={variationForm.barcode}
                  onChange={(e) => setVariationForm({ ...variationForm, barcode: e.target.value })}
                  placeholder="Variation Barcode"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={addVariation}
                  className="w-full px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium text-sm transition-colors">
                  Add Variation
                </button>
              </div>
            </div>

            {/* List of Variations */}
            {variations.length > 0 ? (
              <div className="mt-4 space-y-2">
                <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                  Active Variations ({variations.length})
                </h3>
                <div className="divide-y divide-neutral-200 border border-neutral-200 rounded-lg bg-white overflow-hidden">
                  {variations.map((variation, index) => (
                    <div key={variation._id || index} className="p-3 hover:bg-neutral-50 transition-colors">
                      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 text-xs flex items-center justify-center font-bold">
                          {index + 1}
                        </span>
                        <div>
                          <span className="font-semibold text-neutral-800 text-sm">{variation.title || variation.value}</span>
                          <span className="text-neutral-500 text-xs ml-2">₹{variation.price}</span>
                          {variation.discPrice > 0 && (
                            <span className="text-teal-600 text-xs ml-1.5 font-medium">
                              (Disc: ₹{variation.discPrice})
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-end gap-2 text-xs text-neutral-600">
                        <label className="block">
                          <span className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">SKU</span>
                          <input value={variation.sku || ""} onChange={(event) => setVariations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, sku: event.target.value } : item))} className="w-28 px-2 py-1.5 border rounded font-mono" placeholder="SKU" />
                        </label>
                        <label className="block">
                          <span className="block text-[10px] uppercase font-bold text-neutral-400 mb-1">Barcode</span>
                          <input value={variation.barcode || ""} onChange={(event) => setVariations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, barcode: event.target.value } : item))} className="w-40 px-2 py-1.5 border rounded font-mono" placeholder="Barcode" />
                        </label>
                        <button type="button" onClick={() => generateAndSaveBarcode(index)} className="px-2 py-1.5 rounded bg-teal-600 text-white font-semibold">Generate</button>
                        {variation.barcode && <button type="button" onClick={() => copyBarcode(variation.barcode!)} className="px-2 py-1.5 text-teal-700 font-semibold">Copy</button>}
                        {variation.barcode && <button type="button" onClick={() => printBarcodeLabel({ productName: formData.productName || "Product", variantName: variation.title || variation.value, sku: variation.sku, barcode: variation.barcode! })} className="px-2 py-1.5 text-teal-700 font-semibold">Print Label</button>}
                        <span>
                          Stock:{" "}
                          <strong>{variation.stock === 0 ? "Unlimited" : variation.stock}</strong>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full ${
                            variation.status === "Available" || variation.status === "In stock"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                          {variation.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeVariation(index)}
                          className="text-red-600 hover:text-red-800 font-medium transition-colors"
                          title="Remove Variation">
                          Remove
                        </button>
                      </div>
                      </div>
                      {variation.barcode && <div className="mt-2 max-w-sm"><BarcodeGraphic value={variation.barcode} height={38} /></div>}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-lg">
                ⚠️ At least one variation with price and stock is required.
              </p>
            )}
          </div>
        </div>

        {/* Product Images */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">Product Images</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-6">
            {/* Main Image */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Main Image <span className="text-red-500">*</span>
              </label>
              <label className="block border-2 border-dashed border-neutral-300 rounded-lg p-6 text-center hover:border-teal-500 transition-colors cursor-pointer bg-neutral-50">
                {mainImagePreview ? (
                  <div className="space-y-2">
                    <img
                      src={mainImagePreview}
                      alt="Main Preview"
                      className="max-h-48 mx-auto rounded-lg object-cover shadow-sm"
                    />
                    <p className="text-xs text-neutral-500">
                      {mainImageFile ? mainImageFile.name : "Current Main Image"} (Click to replace)
                    </p>
                  </div>
                ) : (
                  <div>
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mx-auto mb-2 text-neutral-400">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                    <p className="text-sm text-neutral-700 font-medium">Upload Main Image</p>
                    <p className="text-xs text-neutral-400 mt-1">JPG, PNG, WebP up to 10MB</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleMainImageChange}
                  className="hidden"
                />
              </label>
            </div>

            {/* Gallery Images */}
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-2">
                Gallery Images <span className="text-xs text-neutral-400 font-normal">(Optional)</span>
              </label>
              <div className="border-2 border-dashed border-neutral-300 rounded-lg p-6 bg-neutral-50">
                {galleryImagePreviews.length > 0 ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {galleryImagePreviews.map((preview, index) => (
                        <div key={index} className="relative group rounded-lg overflow-hidden border border-neutral-200">
                          <img
                            src={preview}
                            alt={`Gallery ${index + 1}`}
                            className="w-full h-28 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeGalleryImage(index)}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 shadow hover:bg-red-700 transition-colors"
                            title="Remove image">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      <label className="h-28 border-2 border-dashed border-neutral-300 rounded-lg flex flex-col items-center justify-center text-neutral-400 hover:text-teal-600 hover:border-teal-500 cursor-pointer transition-colors bg-white">
                        <span className="text-2xl font-bold">+</span>
                        <span className="text-xs font-semibold">Add Image</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleGalleryImagesChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <label className="cursor-pointer block text-center py-4">
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mx-auto mb-2 text-neutral-400">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <p className="text-sm text-neutral-700 font-medium">Upload Gallery Images</p>
                    <p className="text-xs text-neutral-400 mt-1">Upload multiple product images</p>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryImagesChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Specifications */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">Product Specifications & Policies</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Manufacturer
                </label>
                <input
                  type="text"
                  name="manufacturer"
                  value={formData.manufacturer}
                  onChange={handleChange}
                  placeholder="Manufacturer name"
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Made In
                </label>
                <input
                  type="text"
                  name="madeIn"
                  value={formData.madeIn}
                  onChange={handleChange}
                  placeholder="e.g. India"
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Select Tax (GST)
                </label>
                <select
                  name="tax"
                  value={formData.tax}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                  <option value="">No Tax / Select Tax</option>
                  {taxes.map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name} ({t.percentage}%)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  HSN Code
                </label>
                <input
                  type="text"
                  name="hsnCode"
                  value={formData.hsnCode}
                  onChange={handleChange}
                  placeholder="Optional; shown on GST invoices"
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Is Returnable?
                </label>
                <select
                  name="isReturnable"
                  value={formData.isReturnable}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                  <option value="No">No</option>
                  <option value="Yes">Yes</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Max Return Days
                </label>
                <input
                  type="number"
                  min="0"
                  name="maxReturnDays"
                  value={formData.maxReturnDays}
                  onChange={handleChange}
                  placeholder="e.g. 7"
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  FSSAI Lic. No.
                </label>
                <input
                  type="text"
                  name="fssaiLicNo"
                  value={formData.fssaiLicNo}
                  onChange={handleChange}
                  placeholder="Enter FSSAI Lic. No."
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Total Allowed Quantity Per Order
                </label>
                <input
                  type="number"
                  min="1"
                  name="totalAllowedQuantity"
                  value={formData.totalAllowedQuantity}
                  onChange={handleChange}
                  placeholder="10"
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Shop By Store Only */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">Shop by Store Configuration</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">
                  Show in "Shop by Store" Only?
                </label>
                <select
                  name="isShopByStoreOnly"
                  value={formData.isShopByStoreOnly}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                  <option value="No">No (Show in normal catalogue)</option>
                  <option value="Yes">Yes (Exclusive to Store page)</option>
                </select>
              </div>

              {formData.isShopByStoreOnly === "Yes" && (
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Select Target Store <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="shopId"
                    value={formData.shopId}
                    onChange={handleChange}
                    required={formData.isShopByStoreOnly === "Yes"}
                    className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                    <option value="">Select Store</option>
                    {shops.map((shop) => (
                      <option key={shop._id} value={shop._id}>
                        {shop.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* SEO Metadata */}
        <div className="bg-white rounded-lg shadow-sm border border-neutral-200 overflow-hidden">
          <div className="bg-teal-600 text-white px-4 sm:px-6 py-3">
            <h2 className="text-base sm:text-lg font-semibold">SEO & Search Optimization</h2>
          </div>
          <div className="p-4 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">SEO Title</label>
                <input
                  type="text"
                  name="seoTitle"
                  value={formData.seoTitle}
                  onChange={handleChange}
                  placeholder="Enter SEO Title"
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-2">SEO Keywords</label>
                <input
                  type="text"
                  name="seoKeywords"
                  value={formData.seoKeywords}
                  onChange={handleChange}
                  placeholder="e.g. organic, healthy, snacks"
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">SEO Image Alt Text</label>
                <input
                  type="text"
                  name="seoImageAlt"
                  value={formData.seoImageAlt}
                  onChange={handleChange}
                  placeholder="Alt text describing main image"
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-neutral-700 mb-2">SEO Description</label>
                <textarea
                  name="seoDescription"
                  value={formData.seoDescription}
                  onChange={handleChange}
                  placeholder="Enter meta description for search engines"
                  rows={2}
                  className="w-full px-4 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-neutral-200">
          <Link
            to="/admin/product/list"
            className="px-6 py-2.5 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-100 font-medium transition-colors">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className={`px-8 py-2.5 rounded-lg font-medium text-white shadow-md transition-all ${
              submitting
                ? "bg-neutral-400 cursor-not-allowed"
                : "bg-teal-600 hover:bg-teal-700 active:scale-95"
            }`}>
            {submitting ? "Saving Changes..." : isAddMode ? "Create Product" : "Update Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
