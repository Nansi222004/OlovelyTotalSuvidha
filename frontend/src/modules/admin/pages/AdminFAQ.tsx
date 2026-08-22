import { useState, useEffect } from "react";
import {
  getFAQs,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  type FAQ,
  type CreateFAQData,
  type UpdateFAQData,
} from "../../../services/api/admin/adminContentService";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../context/ToastContext";
import ConfirmationModal from "../../../components/ConfirmationModal";
import api from "../../../services/api/config";

export default function AdminFAQ() {
  const { isAuthenticated, token } = useAuth();
  const { showToast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [faqQuestion, setFaqQuestion] = useState("");
  const [faqAnswer, setFaqAnswer] = useState("");
  const [translations, setTranslations] = useState<Record<string, Record<string, string>>>({
    hi: { question: "", answer: "" },
    mr: { question: "", answer: "" },
    gu: { question: "", answer: "" },
  });
  const [activeTab, setActiveTab] = useState<"en" | "hi" | "mr" | "gu">("en");
  const [translating, setTranslating] = useState(false);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch FAQs on component mount
  useEffect(() => {
    if (!isAuthenticated || !token) {
      setLoading(false);
      return;
    }

    const fetchFAQs = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await getFAQs({
          search: searchTerm,
          page: currentPage,
          limit: rowsPerPage,
          sortBy: sortColumn || undefined,
          sortOrder: sortDirection,
        });

        if (response.success) {
          setFaqs(response.data);
        } else {
          setError("Failed to load FAQs");
        }
      } catch (err: any) {
        console.error("Error fetching FAQs:", err);
        setError(
          err.response?.data?.message ||
          "Failed to load FAQs. Please try again."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchFAQs();
  }, [
    isAuthenticated,
    token,
    searchTerm,
    currentPage,
    rowsPerPage,
    sortColumn,
    sortDirection,
  ]);

  // Note: Filtering is done server-side, so we just use the faqs as is
  const displayedFAQs = faqs;

  // For pagination display (simplified - in real app, this would come from API)
  const totalPages = Math.ceil(displayedFAQs.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: string }) => (
    <span className="text-neutral-300 text-[10px]">
      {sortColumn === column ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}
    </span>
  );

  const handleAutoTranslate = async () => {
    if (!faqQuestion.trim() && !faqAnswer.trim()) {
      showToast("Please enter English question or answer first", "error");
      return;
    }

    try {
      setTranslating(true);
      const res = await api.post("/admin/translation/batch", {
        fields: {
          question: faqQuestion.trim(),
          answer: faqAnswer.trim(),
        },
      });

      if (res.data && res.data.success && res.data.translations) {
        setTranslations((prev) => ({
          ...prev,
          ...res.data.translations,
        }));
        showToast("Auto-translation generated successfully!", "success");
      }
    } catch (err: any) {
      console.error("Auto translate error:", err);
      showToast("Auto-translation failed: " + (err.response?.data?.message || err.message), "error");
    } finally {
      setTranslating(false);
    }
  };

  const handleAddFAQ = async () => {
    if (!faqQuestion.trim() || !faqAnswer.trim()) {
      showToast("Please fill in both question and answer", "error");
      return;
    }

    try {
      setSubmitting(true);

      if (editingFAQ !== null) {
        // Update existing FAQ
        const updateData: UpdateFAQData & { translations?: any } = {
          question: faqQuestion.trim(),
          answer: faqAnswer.trim(),
          translations,
        };

        const response = await updateFAQ(editingFAQ._id, updateData as any);

        if (response.success) {
          // Update local state
          setFaqs((prev) =>
            prev.map((faq) =>
              faq._id === editingFAQ._id
                ? {
                  ...faq,
                  question: faqQuestion.trim(),
                  answer: faqAnswer.trim(),
                  translations,
                }
                : faq
            )
          );
          showToast("FAQ updated successfully!", "success");
          setEditingFAQ(null);
        } else {
          showToast(
            "Failed to update FAQ: " + (response.message || "Unknown error"),
            "error"
          );
        }
      } else {
        // Add new FAQ
        const faqData: CreateFAQData & { translations?: any } = {
          question: faqQuestion.trim(),
          answer: faqAnswer.trim(),
          isActive: true,
          translations,
        };

        const response = await createFAQ(faqData as any);

        if (response.success) {
          // Add to local state
          setFaqs((prev) => [...prev, response.data]);
          showToast("FAQ added successfully!", "success");
        } else {
          showToast("Failed to add FAQ: " + (response.message || "Unknown error"), "error");
        }
      }

      // Reset form
      setFaqQuestion("");
      setFaqAnswer("");
    } catch (err: any) {
      console.error("Error saving FAQ:", err);
      showToast(
        "Failed to save FAQ: " +
        (err.response?.data?.message || "Please try again."),
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (faq: FAQ) => {
    setFaqQuestion(faq.question);
    setFaqAnswer(faq.answer);
    setEditingFAQ(faq);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      setSubmitting(true);
      const response = await deleteFAQ(deleteId);

      if (response.success) {
        // Remove from local state
        setFaqs((prev) => prev.filter((faq) => faq._id !== deleteId));
        showToast("FAQ deleted successfully!", "success");

        // Reset form if editing this FAQ
        if (editingFAQ?._id === deleteId) {
          setEditingFAQ(null);
          setFaqQuestion("");
          setFaqAnswer("");
        }
        setDeleteId(null);
      } else {
        showToast("Failed to delete FAQ: " + (response.message || "Unknown error"), "error");
        setDeleteId(null);
      }
    } catch (err: any) {
      console.error("Error deleting FAQ:", err);
      showToast(
        "Failed to delete FAQ: " +
        (err.response?.data?.message || "Please try again."),
        "error"
      );
      setDeleteId(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = () => {
    const headers = ["ID", "FAQ Question", "FAQ Answer"];
    const csvContent = [
      headers.join(","),
      ...displayedFAQs.map((faq) =>
        [faq._id, `"${faq.question}"`, `"${faq.answer}"`].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `faqs_${new Date().toISOString().split("T")[0]}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Page Header */}
      <div className="p-6 pb-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-neutral-800">FAQ</h1>
          <div className="text-sm text-blue-500">
            <span className="text-blue-500 hover:underline cursor-pointer">
              Home
            </span>{" "}
            <span className="text-neutral-400">/</span>{" "}
            <span className="text-blue-500 hover:underline cursor-pointer">
              Dashboard
            </span>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <div className="flex-1 px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Add FAQ */}
          <div className="lg:col-span-5 min-w-0 bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingFAQ ? "Edit FAQ" : "Add FAQ"}</h2>
              <button
                type="button"
                onClick={handleAutoTranslate}
                disabled={translating || !faqQuestion.trim()}
                className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors disabled:opacity-50">
                {translating ? "Translating..." : "🌐 Auto-Translate"}
              </button>
            </div>
            <div className="p-6 flex-1 flex flex-col">
              {/* Language Tabs */}
              <div className="flex border-b border-neutral-200 mb-4 gap-2">
                {(["en", "hi", "mr", "gu"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setActiveTab(lang)}
                    className={`pb-2 px-3 text-xs font-semibold border-b-2 transition-colors ${
                      activeTab === lang
                        ? "border-teal-600 text-teal-700 font-bold"
                        : "border-transparent text-neutral-500 hover:text-neutral-700"
                    }`}>
                    {lang === "en" ? "English" : lang === "hi" ? "हिंदी" : lang === "mr" ? "मराठी" : "ગુજરાતી"}
                  </button>
                ))}
              </div>

              <div className="space-y-4 flex-1">
                {activeTab === "en" ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        FAQ Question (English) *
                      </label>
                      <input
                        type="text"
                        value={faqQuestion}
                        onChange={(e) => setFaqQuestion(e.target.value)}
                        placeholder="Enter FAQ Question"
                        className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        FAQ Answer (English) *
                      </label>
                      <textarea
                        value={faqAnswer}
                        onChange={(e) => setFaqAnswer(e.target.value)}
                        placeholder="Enter FAQ Answer"
                        rows={6}
                        className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        FAQ Question ({activeTab.toUpperCase()})
                      </label>
                      <input
                        type="text"
                        value={translations[activeTab]?.question || ""}
                        onChange={(e) =>
                          setTranslations((prev) => ({
                            ...prev,
                            [activeTab]: { ...prev[activeTab], question: e.target.value },
                          }))
                        }
                        placeholder={`Enter question in ${activeTab.toUpperCase()}`}
                        className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        FAQ Answer ({activeTab.toUpperCase()})
                      </label>
                      <textarea
                        value={translations[activeTab]?.answer || ""}
                        onChange={(e) =>
                          setTranslations((prev) => ({
                            ...prev,
                            [activeTab]: { ...prev[activeTab], answer: e.target.value },
                          }))
                        }
                        placeholder={`Enter answer in ${activeTab.toUpperCase()}`}
                        rows={6}
                        className="w-full px-3 py-2 border border-neutral-300 rounded focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none"
                      />
                    </div>
                  </>
                )}
              </div>
              <div className="mt-6">
                <button
                  onClick={handleAddFAQ}
                  disabled={submitting}
                  className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-neutral-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium transition-colors flex items-center justify-center">
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingFAQ ? "Updating..." : "Adding..."}
                    </>
                  ) : editingFAQ ? (
                    "Update FAQ"
                  ) : (
                    "Add FAQ"
                  )}
                </button>
                {editingFAQ && (
                  <button
                    onClick={() => {
                      setEditingFAQ(null);
                      setFaqQuestion("");
                      setFaqAnswer("");
                    }}
                    className="w-full mt-2 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded font-medium transition-colors">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: View FAQ */}
          <div className="lg:col-span-7 min-w-0 bg-white rounded-lg shadow-sm border border-neutral-200 flex flex-col">
            <div className="bg-teal-600 text-white px-6 py-4 rounded-t-lg">
              <h2 className="text-lg font-semibold">View FAQ</h2>
            </div>

            {/* Controls */}
            <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-600">Show</span>
                <select
                  value={rowsPerPage}
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-neutral-300 rounded py-1.5 px-3 text-sm focus:ring-1 focus:ring-teal-500 focus:outline-none cursor-pointer">
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExport}
                  className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors">
                  Export
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-1">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 text-xs">
                    Search:
                  </span>
                  <input
                    type="text"
                    className="pl-14 pr-3 py-1.5 bg-neutral-100 border-none rounded text-sm focus:ring-1 focus:ring-teal-500 w-48"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder=""
                  />
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse border border-neutral-200">
                <thead>
                  <tr className="bg-neutral-50 text-xs font-bold text-neutral-800">
                    <th
                      className="p-4 w-16 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                      onClick={() => handleSort("id")}>
                      <div className="flex items-center justify-between">
                        ID <SortIcon column="id" />
                      </div>
                    </th>
                    <th
                      className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                      onClick={() => handleSort("question")}>
                      <div className="flex items-center justify-between">
                        FAQ Question <SortIcon column="question" />
                      </div>
                    </th>
                    <th
                      className="p-4 border border-neutral-200 cursor-pointer hover:bg-neutral-100 transition-colors"
                      onClick={() => handleSort("answer")}>
                      <div className="flex items-center justify-between">
                        FAQ Answer <SortIcon column="answer" />
                      </div>
                    </th>
                    <th className="p-4 border border-neutral-200">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600 mr-2"></div>
                          Loading FAQs...
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-red-600">
                        {error}
                      </td>
                    </tr>
                  ) : displayedFAQs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-8 text-center text-neutral-400 border border-neutral-200">
                        No FAQs found.
                      </td>
                    </tr>
                  ) : (
                    displayedFAQs.map((faq) => (
                      <tr
                        key={faq._id}
                        className="hover:bg-neutral-50 transition-colors text-sm text-neutral-700">
                        <td className="p-4 align-middle border border-neutral-200">
                          {faq._id.slice(-6)}
                        </td>
                        <td className="p-4 align-middle border border-neutral-200">
                          {faq.question}
                        </td>
                        <td className="p-4 align-middle border border-neutral-200">
                          {faq.answer}
                        </td>
                        <td className="p-4 align-middle border border-neutral-200">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEdit(faq)}
                              disabled={submitting}
                              className="p-1.5 bg-green-600 hover:bg-green-700 disabled:bg-neutral-400 disabled:cursor-not-allowed text-white rounded transition-colors"
                              title="Edit">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                              </svg>
                            </button>
                            <button
                              onClick={() => setDeleteId(faq._id)}
                              disabled={submitting}
                              className="p-1.5 bg-red-600 hover:bg-red-700 disabled:bg-neutral-400 disabled:cursor-not-allowed text-white rounded transition-colors"
                              title="Delete">
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 sm:px-6 py-3 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-0">
              <div className="text-xs sm:text-sm text-neutral-700">
                Showing {startIndex + 1} to{" "}
                {Math.min(endIndex, displayedFAQs.length)} of{" "}
                {displayedFAQs.length} entries
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(1, prev - 1))
                  }
                  disabled={currentPage === 1}
                  className={`p-2 border border-teal-600 rounded ${currentPage === 1
                      ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                      : "text-teal-600 hover:bg-teal-50"
                    }`}
                  aria-label="Previous page">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M15 18L9 12L15 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button className="px-3 py-1.5 border border-teal-600 bg-teal-600 text-white rounded font-medium text-sm">
                  {currentPage}
                </button>
                <button
                  onClick={() =>
                    setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                  }
                  disabled={currentPage === totalPages}
                  className={`p-2 border border-teal-600 rounded ${currentPage === totalPages
                      ? "text-neutral-400 cursor-not-allowed bg-neutral-50"
                      : "text-teal-600 hover:bg-teal-50"
                    }`}
                  aria-label="Next page">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M9 18L15 12L9 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-4 text-sm text-neutral-600 border-t border-neutral-200 bg-white">
        Copyright © 2025. Developed By{" "}
        <a href="#" className="text-blue-600 hover:underline">
          Olovely Total Suvidha
        </a>
      </footer>

      <ConfirmationModal
        isOpen={!!deleteId}
        title="Delete FAQ"
        message="Are you sure you want to delete this FAQ?"
        confirmText="Delete"
        variant="danger"
        isLoading={submitting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  );
}

