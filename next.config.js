const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      '/api/admin/extract-questions': ['./pages/api/admin/question_parser.py'],
    },
  },
};

module.exports = nextConfig;
