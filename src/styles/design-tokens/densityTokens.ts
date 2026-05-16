export const densityTokens = {
  desktop: {
    page: {
      paddingX: "28px",
      paddingY: "20px",
      headerHeight: "56px",
      contentGap: "20px",
      sectionGap: "18px",
    },

    sidebar: {
      width: "236px",
      paddingX: "16px",
      paddingY: "18px",
      navItemHeight: "48px",
      navItemGap: "8px",
      footerCardHeight: "72px",
    },

    card: {
      padding: "18px",
      paddingCompact: "14px",
      gap: "14px",
      radius: "14px",
    },

    panel: {
      padding: "16px",
      gap: "14px",
      headerGap: "10px",
    },

    list: {
      rowHeight: "72px",
      rowHeightCompact: "64px",
      rowPaddingX: "16px",
      rowPaddingY: "10px",
      rowGap: "8px",
    },

    form: {
      inputHeight: "44px",
      textareaMinHeight: "88px",
      textareaCompactMinHeight: "72px",
      fieldGap: "10px",
      labelGap: "6px",
    },

    button: {
      heightSm: "36px",
      heightMd: "42px",
      heightLg: "48px",
      paddingXSm: "12px",
      paddingXMd: "16px",
      paddingXLg: "20px",
    },

    chip: {
      height: "24px",
      paddingX: "8px",
      fontSize: "12px",
    },

    icon: {
      sm: "16px",
      md: "20px",
      lg: "28px",
      circleSm: "36px",
      circleMd: "44px",
      circleLg: "56px",
    },

    typography: {
      pageTitle: {
        fontSize: "32px",
        lineHeight: "38px",
      },
      sectionTitle: {
        fontSize: "18px",
        lineHeight: "24px",
      },
      cardTitle: {
        fontSize: "16px",
        lineHeight: "22px",
      },
      body: {
        fontSize: "14px",
        lineHeight: "21px",
      },
      meta: {
        fontSize: "12px",
        lineHeight: "16px",
      },
    },
  },
} as const;
