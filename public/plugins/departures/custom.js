sf.display.ImageDrum = function() {
  return [
    ' ',
    'SWA',
    'AAL',
    'BAW',
    'DAL',
    'UAE',
    'KLM',
    'DLH',
    'ASA',
    'UAL',
    'FDX',
    'PXM',
    'SKW',
    'JBU',
    'ACA',
    'QXE',
    'NKS',
    'VIR',
    'LXJ',
    'QFA'
  ];
};

sf.plugins.departures = {
  dataType: 'json',

  url: function(options) {
    return 'api/departures';
  },

  formatData: function(response) {
    return response.data;
  }
};
