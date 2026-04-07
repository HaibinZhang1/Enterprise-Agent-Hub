export const themeConfig = {
  token: {
    colorPrimary: '#0066cc', // Apple blue
    colorInfo: '#0066cc',
    colorSuccess: '#34c759',
    colorWarning: '#ffcc00',
    colorError: '#ff3b30',
    borderRadius: 8,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"',
    colorBgBase: '#ffffff',
    colorTextBase: '#1d1d1f', // Apple dark gray
    wireframe: false,
  },
  components: {
    Button: {
      controlHeight: 36,
      borderRadius: 8,
      boxShadow: 'none',
      primaryShadow: 'none',
    },
    Input: {
      controlHeight: 36,
      borderRadius: 8,
      colorBgContainer: '#f5f5f7',
      colorBorder: 'transparent',
    },
    Select: {
      controlHeight: 36,
      borderRadius: 8,
      colorBgContainer: '#f5f5f7',
      colorBorder: 'transparent',
    },
    Card: {
      borderRadiusLG: 16,
      boxShadowTertiary: '0 4px 24px rgba(0,0,0,0.04)',
    },
    Layout: {
      colorBgHeader: 'rgba(255, 255, 255, 0.8)',
      colorBgBody: '#f5f5f7',
    },
    Menu: {
      itemBorderRadius: 8,
      itemHeight: 40,
    }
  }
};
