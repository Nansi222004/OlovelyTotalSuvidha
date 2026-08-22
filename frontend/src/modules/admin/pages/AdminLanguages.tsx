import React, { useEffect, useState } from "react";
import { useTranslation } from "../../../hooks/useTranslation";
import api from "../../../services/api/config";

interface LanguageItem {
  _id: string;
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  uiTranslationCount?: number;
  totalEnglishKeys?: number;
  progressPercentage?: number;
}

interface UITranslationKey {
  _id: string;
  key: string;
  languageCode: string;
  sourceText: string;
  translatedText: string;
  isManual: boolean;
}

export default function AdminLanguages() {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState<LanguageItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editingLang, setEditingLang] = useState<LanguageItem | null>(null);

  // Add/Edit Form State
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    nativeName: "",
    flag: "🇮🇳",
    sortOrder: 0,
    isActive: true,
    isDefault: false,
  });

  // UI Translation Drawer/Modal State
  const [showTranslationModal, setShowTranslationModal] = useState<boolean>(false);
  const [activeLangCode, setActiveLangCode] = useState<string>("");
  const [uiKeys, setUiKeys] = useState<UITranslationKey[]>([]);
  const [loadingKeys, setLoadingKeys] = useState<boolean>(false);
  const [searchKeyQuery, setSearchKeyQuery] = useState<string>("");
  const [generatingCode, setGeneratingCode] = useState<string | null>(null);

  // Edit single key translation
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [editedTextValue, setEditedTextValue] = useState<string>("");

  const fetchLanguages = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await api.get("/admin/languages");
      if (res.data?.success) {
        setLanguages(res.data.data);
      } else {
        setError(res.data?.message || "Failed to load languages");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLanguages();
  }, []);

  const handleOpenAddModal = () => {
    setFormData({
      code: "",
      name: "",
      nativeName: "",
      flag: "🇮🇳",
      sortOrder: languages.length + 1,
      isActive: true,
      isDefault: false,
    });
    setShowAddModal(true);
  };

  const handleOpenEditModal = (lang: LanguageItem) => {
    setEditingLang(lang);
    setFormData({
      code: lang.code,
      name: lang.name,
      nativeName: lang.nativeName,
      flag: lang.flag || "🌐",
      sortOrder: lang.sortOrder || 0,
      isActive: lang.isActive,
      isDefault: lang.isDefault,
    });
    setShowEditModal(true);
  };

  const handleCreateLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError("");
      const res = await api.post("/admin/languages", formData);
      if (res.data?.success) {
        setSuccessMsg(`Language '${formData.name}' created successfully`);
        setShowAddModal(false);
        fetchLanguages();
      } else {
        setError(res.data?.message || "Failed to create language");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to create language");
    }
  };

  const handleUpdateLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLang) return;

    try {
      setError("");
      const res = await api.put(`/admin/languages/${editingLang._id}`, formData);
      if (res.data?.success) {
        setSuccessMsg(`Language '${formData.name}' updated successfully`);
        setShowEditModal(false);
        fetchLanguages();
      } else {
        setError(res.data?.message || "Failed to update language");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to update language");
    }
  };

  const handleToggleStatus = async (lang: LanguageItem) => {
    try {
      setError("");
      const res = await api.patch(`/admin/languages/${lang._id}/status`, { isActive: !lang.isActive });
      if (res.data?.success) {
        setSuccessMsg(res.data.message);
        fetchLanguages();
      } else {
        setError(res.data?.message || "Failed to toggle language status");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Error updating status");
    }
  };

  const handleSetDefault = async (lang: LanguageItem) => {
    try {
      setError("");
      const res = await api.patch(`/admin/languages/${lang._id}/default`);
      if (res.data?.success) {
        setSuccessMsg(`'${lang.name}' is now the default language`);
        fetchLanguages();
      } else {
        setError(res.data?.message || "Failed to set default language");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Error setting default language");
    }
  };

  const handleDeleteLanguage = async (lang: LanguageItem) => {
    if (!window.confirm(`Are you sure you want to delete '${lang.name}' (${lang.code})?`)) return;

    try {
      setError("");
      const res = await api.delete(`/admin/languages/${lang._id}`);
      if (res.data?.success) {
        setSuccessMsg(`Language '${lang.name}' deleted`);
        fetchLanguages();
      } else {
        setError(res.data?.message || "Failed to delete language");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Error deleting language");
    }
  };

  const handleGenerateTranslations = async (code: string) => {
    try {
      setGeneratingCode(code);
      setError("");
      const res = await api.post(`/admin/languages/${code}/generate-ui-translations`, { forceRegenerate: false });
      if (res.data?.success) {
        setSuccessMsg(res.data.message);
        fetchLanguages();
      } else {
        setError(res.data?.message || "Failed to generate UI translations");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Error generating translations");
    } finally {
      setGeneratingCode(null);
    }
  };

  const handleViewTranslations = async (code: string) => {
    setActiveLangCode(code);
    setShowTranslationModal(true);
    fetchLanguageKeys(code);
  };

  const fetchLanguageKeys = async (code: string) => {
    try {
      setLoadingKeys(true);
      const res = await api.get(`/admin/languages/${code}/ui-translations`);
      if (res.data?.success) {
        setUiKeys(res.data.data);
      }
    } catch (err) {
      // Ignore
    } finally {
      setLoadingKeys(false);
    }
  };

  const handleSaveSingleKey = async (keyId: string) => {
    try {
      const res = await api.put(`/admin/languages/${activeLangCode}/ui-translations/${keyId}`, { translatedText: editedTextValue });
      if (res.data?.success) {
        setEditingKeyId(null);
        fetchLanguageKeys(activeLangCode);
        fetchLanguages();
      }
    } catch (err) {
      // Ignore
    }
  };

  const filteredKeys = uiKeys.filter(
    (k) =>
      k.key.toLowerCase().includes(searchKeyQuery.toLowerCase()) ||
      k.sourceText.toLowerCase().includes(searchKeyQuery.toLowerCase()) ||
      k.translatedText.toLowerCase().includes(searchKeyQuery.toLowerCase())
  );

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <span>🌐</span>
            <span>{t("admin.languageManagement", "Language Management & i18n")}</span>
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            Manage supported application languages, configure default language, and auto-translate UI keys via Google Cloud Translation.
          </p>
        </div>
        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm rounded-xl transition-colors shadow-sm">
          <span>+</span>
          <span>Add Language</span>
        </button>
      </div>

      {/* Alert Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError("")} className="font-bold">×</button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="font-bold">×</button>
        </div>
      )}

      {/* Languages List Grid */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-neutral-200">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-teal-600 mx-auto mb-3"></div>
          <p className="text-neutral-500 text-sm">Loading language settings...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          {languages.map((lang) => (
            <div
              key={lang._id}
              className={`bg-white rounded-2xl border p-5 transition-all shadow-sm flex flex-col justify-between ${
                lang.isDefault ? "border-teal-500 ring-2 ring-teal-500/20" : "border-neutral-200 hover:border-neutral-300"
              }`}>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{lang.flag || "🌐"}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base text-neutral-900">{lang.nativeName}</h3>
                        <span className="text-xs text-neutral-400 font-mono">({lang.name})</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="px-2 py-0.5 bg-neutral-100 font-mono text-[10px] text-neutral-600 rounded font-semibold uppercase">
                          Code: {lang.code}
                        </span>
                        {lang.isDefault && (
                          <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-[10px] font-bold rounded-full">
                            ★ DEFAULT
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                            lang.isActive ? "bg-emerald-100 text-emerald-700" : "bg-neutral-100 text-neutral-500"
                          }`}>
                          {lang.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(lang)}
                      className="p-1.5 text-neutral-500 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors"
                      title="Edit Language">
                      ✏️
                    </button>
                    {!lang.isDefault && (
                      <button
                        onClick={() => handleDeleteLanguage(lang)}
                        className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Language">
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {/* Translation Progress Bar */}
                <div className="mt-4 pt-3 border-t border-neutral-100">
                  <div className="flex justify-between items-center text-xs font-semibold mb-1.5">
                    <span className="text-neutral-600">UI Translation Progress</span>
                    <span className="text-teal-700">{lang.progressPercentage || 0}%</span>
                  </div>
                  <div className="w-full bg-neutral-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-teal-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${lang.progressPercentage || 0}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {!lang.isDefault && (
                    <button
                      onClick={() => handleSetDefault(lang)}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900 bg-teal-50 px-2.5 py-1 rounded-lg hover:bg-teal-100 transition-colors">
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => handleToggleStatus(lang)}
                    disabled={lang.isDefault}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${
                      lang.isActive
                        ? "text-neutral-600 bg-neutral-100 hover:bg-neutral-200"
                        : "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                    }`}>
                    {lang.isActive ? "Disable" : "Enable"}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleGenerateTranslations(lang.code)}
                    disabled={generatingCode === lang.code}
                    className="text-xs font-semibold bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded-lg transition-colors disabled:opacity-50">
                    {generatingCode === lang.code ? "Generating..." : "⚡ Generate Translations"}
                  </button>
                  <button
                    onClick={() => handleViewTranslations(lang.code)}
                    className="text-xs font-semibold bg-neutral-800 hover:bg-neutral-900 text-white px-3 py-1 rounded-lg transition-colors">
                    🔍 View Keys
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ADD LANGUAGE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-neutral-900">Add New Language</h3>
              <button onClick={() => setShowAddModal(false)} className="text-neutral-400 text-xl font-bold">×</button>
            </div>
            <form onSubmit={handleCreateLanguage} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1">Language Code (e.g. ta, te, bn)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ta"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">English Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Tamil"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Native Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. தமிழ்"
                    value={formData.nativeName}
                    onChange={(e) => setFormData({ ...formData, nativeName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Flag Emoji</label>
                  <input
                    type="text"
                    value={formData.flag}
                    onChange={(e) => setFormData({ ...formData, flag: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700">
                  Create Language
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT LANGUAGE MODAL */}
      {showEditModal && editingLang && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="text-lg font-bold text-neutral-900">Edit Language ({editingLang.code})</h3>
              <button onClick={() => setShowEditModal(false)} className="text-neutral-400 text-xl font-bold">×</button>
            </div>
            <form onSubmit={handleUpdateLanguage} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">English Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Native Name</label>
                  <input
                    type="text"
                    required
                    value={formData.nativeName}
                    onChange={(e) => setFormData({ ...formData, nativeName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Flag Emoji</label>
                  <input
                    type="text"
                    value={formData.flag}
                    onChange={(e) => setFormData({ ...formData, flag: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1">Display Order</label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 rounded-xl">
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-sm font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-700">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW & EDIT UI KEYS TRANSLATIONS MODAL */}
      {showTranslationModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 bg-neutral-900 text-white flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-lg font-bold">UI Translation Keys for '{activeLangCode}'</h3>
                <p className="text-xs text-neutral-400">View and manually edit static UI key translations</p>
              </div>
              <button
                onClick={() => setShowTranslationModal(false)}
                className="text-neutral-400 hover:text-white text-2xl font-bold">
                ×
              </button>
            </div>

            <div className="p-4 border-b bg-neutral-50 flex items-center justify-between gap-4 flex-shrink-0">
              <input
                type="text"
                placeholder="Search key or text..."
                value={searchKeyQuery}
                onChange={(e) => setSearchKeyQuery(e.target.value)}
                className="px-3 py-2 border rounded-xl text-xs w-full max-w-xs focus:ring-2 focus:ring-teal-500"
              />
              <span className="text-xs font-semibold text-neutral-600">
                Showing {filteredKeys.length} of {uiKeys.length} keys
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loadingKeys ? (
                <div className="p-12 text-center text-neutral-500">Loading UI keys...</div>
              ) : filteredKeys.length === 0 ? (
                <div className="p-12 text-center text-neutral-500">No UI keys found. Click 'Generate Translations' to auto-translate from English keys.</div>
              ) : (
                filteredKeys.map((item) => (
                  <div key={item._id} className="p-3 border rounded-xl bg-white hover:bg-neutral-50 transition-colors flex items-center justify-between gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded font-bold">
                          {item.key}
                        </span>
                        {item.isManual && (
                          <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded">
                            MANUAL EDIT
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-neutral-500">English: <span className="text-neutral-800 font-medium">"{item.sourceText}"</span></div>
                      
                      {editingKeyId === item._id ? (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            type="text"
                            value={editedTextValue}
                            onChange={(e) => setEditedTextValue(e.target.value)}
                            className="px-3 py-1.5 border rounded-lg text-xs w-full focus:ring-2 focus:ring-teal-500"
                          />
                          <button
                            onClick={() => handleSaveSingleKey(item._id)}
                            className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs font-bold hover:bg-teal-700">
                            Save
                          </button>
                          <button
                            onClick={() => setEditingKeyId(null)}
                            className="px-3 py-1.5 bg-neutral-200 text-neutral-700 rounded-lg text-xs font-semibold">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-teal-800 font-bold">
                          Translation: <span>"{item.translatedText}"</span>
                        </div>
                      )}
                    </div>

                    {editingKeyId !== item._id && (
                      <button
                        onClick={() => {
                          setEditingKeyId(item._id);
                          setEditedTextValue(item.translatedText);
                        }}
                        className="text-xs text-teal-600 font-semibold hover:underline flex-shrink-0">
                        Edit
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
