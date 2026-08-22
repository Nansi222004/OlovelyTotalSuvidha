import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "../../../context/LanguageContext";

interface SubMenuItem {
  label: string;
  path: string;
  icon: JSX.Element;
  badge?: string;
  badgeColor?: string;
}

interface MenuItem {
  label: string;
  path: string;
  hasSubmenu?: boolean;
  submenuItems?: SubMenuItem[];
  icon?: JSX.Element;
  badge?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface AdminSidebarProps {
  onClose?: () => void;
}

const menuSections: MenuSection[] = [
  {
    title: "Product Section",
    items: [
      {
        label: "Category",
        path: "/admin/category",
        hasSubmenu: true,
        submenuItems: [
          {
            label: "Category",
            path: "/admin/category",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  strokeDasharray="4 2"></rect>
                <path d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01"></path>
              </svg>
            ),
          },
          {
            label: "Header Category",
            path: "/admin/category/header",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <rect
                  x="3"
                  y="3"
                  width="18"
                  height="18"
                  rx="2"
                  strokeDasharray="4 2"></rect>
                <path d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01"></path>
              </svg>
            ),
          },
        ],
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="2"
              strokeDasharray="4 2"></rect>
            <path d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01"></path>
          </svg>
        ),
      },
      {
        label: "Brand",
        path: "/admin/brand",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M8 6H21M8 12H21M8 18H21M3 6H3.01M3 12H3.01M3 18H3.01"></path>
          </svg>
        ),
      },
      {
        label: "Product",
        path: "/admin/product",
        hasSubmenu: true,
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"></path>
            <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21"></path>
          </svg>
        ),
        submenuItems: [
          {
            label: "Product List",
            path: "/admin/product/list",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"></path>
                <path d="M14 2V8H20"></path>
                <path d="M9 12L11 14L15 10"></path>
                <path d="M9 16L11 18L15 14"></path>
              </svg>
            ),
          },
          {
            label: "Taxes",
            path: "/admin/product/taxes",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <ellipse cx="12" cy="18" rx="4" ry="2"></ellipse>
                <ellipse cx="12" cy="14" rx="3.5" ry="1.8"></ellipse>
                <ellipse cx="12" cy="10" rx="3" ry="1.5"></ellipse>
                <circle cx="9" cy="9" r="1" fill="currentColor"></circle>
                <line x1="7" y1="7" x2="11" y2="11" strokeWidth="2"></line>
                <circle cx="15" cy="11" r="1" fill="currentColor"></circle>
              </svg>
            ),
          },
        ],
      },
      {
        label: "Manage Seller",
        path: "/admin/manage-seller",
        hasSubmenu: true,
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13"></path>
            <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88"></path>
            <path d="M16 7H22M19 4V10"></path>
          </svg>
        ),
        submenuItems: [
          {
            label: "Manage Seller List",
            path: "/admin/manage-seller/list",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13"></path>
                <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88"></path>
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <path d="M8 7H16M8 11H16M8 15H12"></path>
              </svg>
            ),
          },
          {
            label: "Seller Transaction",
            path: "/admin/manage-seller/transaction",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6V12M12 18V12"></path>
                <path d="M8 12H16"></path>
                <path d="M8 8L12 4L16 8"></path>
                <path d="M8 16L12 20L16 16"></path>
                <path d="M16 8L12 4L8 8"></path>
                <path d="M16 16L12 20L8 16"></path>
              </svg>
            ),
          },
        ],
      },
    ],
  },
  {
    title: "Delivery Section",
    items: [
      {
        label: "Manage Location",
        path: "/admin/manage-location",
        hasSubmenu: true,
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
        ),
        submenuItems: [
          {
            label: "Seller Location",
            path: "/admin/manage-location/seller-location",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z"></path>
                <circle cx="12" cy="10" r="3"></circle>
                <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"></path>
                <circle cx="9" cy="7" r="4"></circle>
              </svg>
            ),
          },
        ],
      },
      {
        label: "Coupon",
        path: "/admin/coupon",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M12 6V12M12 18V12"></path>
            <path d="M8 12H16"></path>
          </svg>
        ),
      },
      {
        label: "Delivery Boy",
        path: "/admin/delivery-boy",
        hasSubmenu: true,
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13"></path>
            <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88"></path>
            <path d="M20 7H22M21 6V8"></path>
          </svg>
        ),
        submenuItems: [
          {
            label: "Manage Delivery Boy",
            path: "/admin/delivery-boy/manage",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
                <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"></path>
                <path d="M14 2V8H20"></path>
                <path d="M8 11H16M8 15H12"></path>
              </svg>
            ),
          },
          {
            label: "Manual Assignment",
            path: "/admin/delivery-boy/manual-assign",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <polyline points="16 11 18 13 22 9"></polyline>
              </svg>
            ),
          },
          {
            label: "Fund Transfer",
            path: "/admin/delivery-boy/fund-transfer",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6V12M12 18V12"></path>
                <path d="M8 12H16"></path>
                <path d="M8 8L12 4L16 8"></path>
                <path d="M8 16L12 20L16 16"></path>
                <path d="M16 8L12 4L8 8"></path>
                <path d="M16 16L12 20L8 16"></path>
              </svg>
            ),
          },
          {
            label: "Cash Collection",
            path: "/admin/delivery-boy/cash-collection",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6V12M12 18V12"></path>
                <path d="M8 12H16"></path>
                <path d="M12 18L10 20L12 22L14 20L12 18Z"></path>
                <path d="M10 20H14"></path>
                <path d="M12 20V22"></path>
              </svg>
            ),
          },
          {
            label: "Delivery Tracking",
            path: "/admin/delivery-tracking",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
            ),
          },
        ],
      },
    ],
  },
  {
    title: "Miscellaneous",
    items: [

      {
        label: "Users",
        path: "/admin/users",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13"></path>
            <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88"></path>
          </svg>
        ),
      },
      {
        label: "Notification",
        path: "/admin/notification",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M18 8A6 6 0 0 0 6 8C6 11.3137 4 14 4 17H20C20 14 18 11.3137 18 8Z"></path>
            <path d="M13.73 21C13.5542 21.3031 13.3019 21.5547 12.9982 21.7295C12.6946 21.9044 12.3504 21.9965 12 21.9965C11.6496 21.9965 11.3054 21.9044 11.0018 21.7295C10.6982 21.5547 10.4458 21.3031 10.27 21"></path>
            <circle cx="18" cy="8" r="3" fill="currentColor"></circle>
          </svg>
        ),
      },


      {
        label: "FAQ",
        path: "/admin/faq",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <rect
              x="3"
              y="3"
              width="18"
              height="18"
              rx="2"
              strokeDasharray="4 2"></rect>
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 9V12M12 15H12.01"></path>
          </svg>
        ),
      },
    ],
  },
  {
    title: "Order Section",
    items: [
      {
        label: "Order List",
        path: "/admin/orders",
        hasSubmenu: true,
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1H4L6.68 14.39C6.77144 14.8504 7.02191 15.264 7.38755 15.5583C7.75318 15.8526 8.2107 16.009 8.68 16H19C19.4693 16.009 19.9268 15.8526 20.2925 15.5583C20.6581 15.264 20.9086 14.8504 21 14.39L22.54 6.62C22.6214 6.22389 22.6172 5.81177 22.528 5.41838C22.4388 5.02499 22.2672 4.66078 22.026 4.35277C21.7848 4.04476 21.4805 3.80134 21.1372 3.63988C20.794 3.47841 20.4208 3.40296 20.044 3.42H5.82M1 1L3 3M1 1V5"></path>
            <circle cx="12" cy="12" r="1"></circle>
            <path d="M12 6V12"></path>
          </svg>
        ),
        submenuItems: [
          {
            label: "All Order",
            path: "/admin/orders/all",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="9" cy="21" r="1"></circle>
                <circle cx="20" cy="21" r="1"></circle>
                <path d="M1 1H4L6.68 14.39C6.77144 14.8504 7.02191 15.264 7.38755 15.5583C7.75318 15.8526 8.2107 16.009 8.68 16H19C19.4693 16.009 19.9268 15.8526 20.2925 15.5583C20.6581 15.264 20.9086 14.8504 21 14.39L22.54 6.62C22.6214 6.22389 22.6172 5.81177 22.528 5.41838C22.4388 5.02499 22.2672 4.66078 22.026 4.35277C21.7848 4.04476 21.4805 3.80134 21.1372 3.63988C20.794 3.47841 20.4208 3.40296 20.044 3.42H5.82M1 1L3 3M1 1V5"></path>
              </svg>
            ),
          },
          {
            label: "Pending Order",
            path: "/admin/orders/pending",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            ),
          },
          {
            label: "Received Order",
            path: "/admin/orders/received",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            ),
          },
          {
            label: "Processed Order",
            path: "/admin/orders/processed",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
            ),
          },
          {
            label: "Shipped Order",
            path: "/admin/orders/shipped",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path>
                <line x1="4" y1="22" x2="4" y2="15"></line>
              </svg>
            ),
          },
          {
            label: "Out For Delivery",
            path: "/admin/orders/out-for-delivery",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
              </svg>
            ),
          },
          {
            label: "Delivered Order",
            path: "/admin/orders/delivered",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            ),
          },
          {
            label: "Cancelled Order",
            path: "/admin/orders/cancelled",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            ),
          },
          {
            label: "Settlement",
            path: "/admin/settlement",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            ),
          },
          {
            label: "Return",
            path: "/admin/return",
            icon: (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">
                <path d="M20 7H4C2.89543 7 2 7.89543 2 9V19C2 20.1046 2.89543 21 4 21H20C21.1046 21 22 20.1046 22 19V9C22 7.89543 21.1046 7 20 7Z"></path>
                <path d="M16 21V5C16 4.46957 15.7893 3.96086 15.4142 3.58579C15.0391 3.21071 14.5304 3 14 3H10C9.46957 3 8.96086 3.21071 8.58579 3.58579C8.21071 3.96086 8 4.46957 8 5V21"></path>
                <path d="M8 12L12 8L16 12M12 8V16"></path>
              </svg>
            ),
          },
        ],
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        label: "Wallet & Earnings",
        path: "/admin/wallet",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M20 7h-9a2 2 0 0 0-2 2v1m0 4v9a2 2 0 0 0 2 2h4" />
            <path d="M19 13h1a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-1" />
            <path d="M6 7H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h15v4H6.5" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Promotion",
    items: [
      {
        label: "Home Section",
        path: "/admin/home-section",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"></path>
            <path d="M9 22V12H15V22"></path>
            <path d="M9 12H15"></path>
          </svg>
        ),
      },
      {
        label: "Bestseller Cards",
        path: "/admin/bestseller-cards",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"></path>
          </svg>
        ),
      },

      {
        label: "Promo Strip",
        path: "/admin/promo-strip",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
            <path d="M3 9H21M9 3V21"></path>
          </svg>
        ),
      },
      {
        label: "Lowest Prices",
        path: "/admin/lowest-prices",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M12 2L2 7L12 12L22 7L12 2Z"></path>
            <path d="M2 17L12 22L22 17"></path>
            <path d="M2 12L12 17L22 12"></path>
          </svg>
        ),
      },

      {
        label: "Shop by Store",
        path: "/admin/shop-by-store",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M3 9L12 2L21 9V20C21 20.5304 20.7893 21.0391 20.4142 21.4142C20.0391 21.7893 19.5304 22 19 22H5C4.46957 22 3.96086 21.7893 3.58579 21.4142C3.21071 21.0391 3 20.5304 3 20V9Z"></path>
            <path d="M9 22V12H15V22"></path>
            <rect x="3" y="3" width="18" height="18" rx="2"></rect>
            <path d="M8 7H16M8 11H16M8 15H12"></path>
          </svg>
        ),
      },
    ],
  },
  {
    title: "Setting",
    items: [
      {
        label: "Language Management",
        path: "/admin/languages",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
          </svg>
        ),
      },
      {
        label: "App Settings & Logo",
        path: "/admin/app-settings",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        ),
      },
      {
        label: "Billing & Charges",
        path: "/admin/billing-settings",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"></rect>
            <line x1="2" y1="10" x2="22" y2="10"></line>
            <line x1="12" y1="15" x2="12" y2="15"></line>
          </svg>
        ),
      },
      {
        label: "System User",
        path: "/admin/system-user",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13"></path>
            <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88"></path>
          </svg>
        ),
      },
      {
        label: "Customer App Policy",
        path: "/admin/customer-app-policy",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"></path>
            <path d="M14 2V8H20"></path>
            <path d="M9 15L11 17L15 13"></path>
          </svg>
        ),
      },
      {
        label: "Delivery App Policy",
        path: "/admin/delivery-app-policy",
        icon: (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"></path>
            <path d="M14 2V8H20"></path>
            <path d="M9 15L11 17L15 13"></path>
          </svg>
        ),
      },
    ],
  },
];

export default function AdminSidebar({ onClose }: AdminSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const isActive = (path: string) => {
    if (path === "/admin") {
      return location.pathname === "/admin" || location.pathname === "/admin/";
    }
    return location.pathname.startsWith(path);
  };

  const isSubmenuActive = (submenuItems?: SubMenuItem[]) => {
    if (!submenuItems) return false;
    return submenuItems.some(
      (item) =>
        location.pathname === item.path ||
        location.pathname.startsWith(item.path + "/")
    );
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (onClose && window.innerWidth < 1024) {
      onClose();
    }
  };

  const toggleMenu = (path: string) => {
    setExpandedMenus((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const isExpanded = (path: string) => {
    const menuItem = menuSections
      .flatMap((section) => section.items)
      .find((item) => item.path === path);
    return (
      expandedMenus.has(path) ||
      (menuItem?.submenuItems && isSubmenuActive(menuItem.submenuItems))
    );
  };

  // Filter menu items based on search query
  const filteredSections = menuSections
    .map((section) => ({
      ...section,
      items: (section.items || []).filter((item) =>
        String(item?.label || "").toLowerCase().includes(String(searchQuery || "").toLowerCase())
      ),
    }))
    .filter((section) => section.items && section.items.length > 0);

  const getSidebarTranslation = (label: string) => {
    const keyMap: Record<string, string> = {
      "Product Section": "admin.productSection",
      "Delivery Section": "admin.deliverySection",
      "Miscellaneous": "admin.miscellaneousSection",
      "Order Section": "admin.orderSection",
      "Finance": "admin.financeSection",
      "Promotion": "admin.promotionSection",
      "Category": "admin.manageCategories",
      "Brand": "common.brand",
      "Product": "admin.manageProducts",
      "Product List": "seller.productList",
      "Taxes": "seller.taxes",
      "Manage Seller": "admin.manageSellers",
      "Manage Seller List": "admin.manageSellers",
      "Seller Transaction": "seller.transaction",
      "Manage Location": "admin.manageLocation",
      "Seller Location": "admin.sellerLocation",
      "Coupon": "admin.coupon",
      "Delivery Boy": "admin.deliveryBoy",
      "Manage Delivery Boy": "admin.deliveryBoy",
      "Manual Assignment": "admin.manualAssign",
      "Fund Transfer": "admin.fundTransfer",
      "Cash Collection": "admin.cashCollection",
      "Delivery Tracking": "seller.deliveryTracking",
      "Users": "admin.users",
      "Notification": "common.notifications",
      "FAQ": "common.faqs",
      "Order List": "seller.orders",
      "All Order": "delivery.allOrders",
      "Pending Order": "delivery.pendingOrders",
      "Received Order": "seller.ordersReceived",
      "Processed Order": "admin.processedOrders",
      "Shipped Order": "admin.shippedOrders",
      "Out For Delivery": "delivery.outForDelivery",
      "Delivered Order": "delivery.delivered",
      "Cancelled Order": "seller.cancelledOrders",
      "Settlement": "seller.settlement",
      "Return": "seller.return",
      "Wallet & Earnings": "seller.totalEarnings",
      "Home Section": "admin.homeSection",
      "Bestseller Cards": "admin.bestsellerCards",
      "SETTING": "admin.settingSection",
      "Promo Strip": "admin.promoStrip",
      "Lowest Prices": "admin.lowestPrices",
      "Shop by Store": "admin.shopByStore",
      "Language Management": "admin.languageManagement",
      "App Settings & Logo": "admin.appSettings",
      "Billing & Charges": "admin.billingSettings",
      "System User": "admin.systemUser",
      "Customer App Policy": "admin.customerAppPolicy",
      "Delivery App Policy": "admin.deliveryAppPolicy"
    };

    if (keyMap[label]) {
      return t(keyMap[label], label);
    }
    return t(`admin.${label.replace(/\s+/g, '')}`, label);
  };

  return (
    <aside className="w-64 bg-teal-700 h-screen flex flex-col">
      {/* Close button - only show on mobile */}
      <div className="flex justify-end p-4 border-b border-teal-600 lg:hidden">
        <button
          onClick={onClose}
          className="p-2 text-teal-100 hover:text-white transition-colors"
          aria-label="Close menu">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg">
            <path
              d="M18 6L6 18M6 6L18 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-4 border-b border-teal-600">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Menu Ctrl + F"
            className="w-full px-3 py-2 pl-10 bg-teal-800 border border-teal-600 rounded text-white placeholder-teal-300 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-teal-300">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="M21 21L16.65 16.65"></path>
          </svg>
        </div>
      </div>

      {/* Dashboard Link */}
      <div className="px-4 py-2 border-b border-teal-600">
        <button
          onClick={() => handleNavigation("/admin")}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${isActive("/admin")
            ? "bg-teal-600 text-white"
            : "text-teal-100 hover:bg-teal-600/50 hover:text-white"
            }`}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
            <circle cx="12" cy="12" r="1"></circle>
            <path d="M12 6V12M12 18V12M6 12H12M18 12H12"></path>
          </svg>
          <span className="text-sm font-medium">{t("admin.dashboard", "Dashboard")}</span>
        </button>
      </div>

      {/* Navigation Menu */}
      <nav
        className="flex-1 py-4 overflow-y-auto admin-sidebar-nav"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
        <style>{`
          .admin-sidebar-nav::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        {filteredSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-6">
            <h3 className="px-4 mb-2 text-xs font-bold text-teal-200 uppercase tracking-wider">
              {getSidebarTranslation(section.title)}
            </h3>
            <ul className="space-y-1 px-2">
              {section.items.map((item) => {
                const expanded = isExpanded(item.path);
                const active =
                  isActive(item.path) || isSubmenuActive(item.submenuItems);

                return (
                  <li key={item.path}>
                    <button
                      onClick={() => {
                        if (item.hasSubmenu) {
                          toggleMenu(item.path);
                        } else {
                          handleNavigation(item.path);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-colors ${active
                        ? "bg-teal-600 text-white"
                        : "text-teal-100 hover:bg-teal-600/50 hover:text-white"
                        }`}>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="flex-shrink-0">{item.icon}</span>
                        <span className="text-sm font-medium truncate">
                          {getSidebarTranslation(item.label)}
                        </span>
                      </div>
                      {item.hasSubmenu && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className={`transition-transform flex-shrink-0 ml-2 ${expanded ? "rotate-90" : ""
                            } ${active ? "text-white" : "text-teal-200"}`}>
                          <path
                            d="M9 18L15 12L9 6"
                            strokeLinecap="round"
                            strokeLinejoin="round"></path>
                        </svg>
                      )}
                    </button>
                    {item.hasSubmenu && expanded && (
                      <ul className="mt-1 space-y-1 ml-4">
                        {item.submenuItems &&
                          item.submenuItems.map((subItem) => {
                            const subActive =
                              location.pathname === subItem.path ||
                              location.pathname.startsWith(subItem.path + "/");
                            return (
                              <li key={subItem.path}>
                                <button
                                  onClick={() => handleNavigation(subItem.path)}
                                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors ${subActive
                                    ? "bg-teal-500 text-white"
                                    : "text-teal-100 hover:bg-teal-600/50 hover:text-white"
                                    }`}>
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <span className="flex-shrink-0">
                                      {subItem.icon}
                                    </span>
                                    <span className="text-sm font-medium truncate">
                                      {getSidebarTranslation(subItem.label)}
                                    </span>
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
