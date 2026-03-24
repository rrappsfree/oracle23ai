module.exports = function(eleventyConfig) {
    eleventyConfig.addGlobalData("permalink", "{{ page.filePathStem }}/index.html");
  // Copy static assets as-is
  eleventyConfig.addPassthroughCopy("src/assets");
  eleventyConfig.addPassthroughCopy("admin");

  // Watch CSS for changes during dev
  eleventyConfig.addWatchTarget("src/assets/");

  // Custom date filter (used in templates)
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric"
    });
  });

  // Limit filter (for showing only N items)
  eleventyConfig.addFilter("limit", (array, n) => array.slice(0, n));

  // Select items where a data property is truthy
    eleventyConfig.addFilter("selectattr", (array, attr) => {
      return array.filter(item => item.data && item.data[attr]);
    });

  // Get posts by category
  eleventyConfig.addFilter("filterByCategory", (posts, category) => {
    return posts.filter(p => p.data.category === category);
  });

  // Collections
  eleventyConfig.addCollection("posts", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/posts/*.md")
      .sort((a, b) => b.date - a.date);
  });

  eleventyConfig.addCollection("support", function(collectionApi) {
    return collectionApi.getFilteredByGlob("src/support/*.md")
      .sort((a, b) => (a.data.order || 99) - (b.data.order || 99));
  });

  eleventyConfig.addCollection("install", function(collectionApi) {
      return collectionApi.getFilteredByGlob("src/install/*.md")
        .sort((a, b) => (a.data.order || 99) - (b.data.order || 99));
  });

return {
  pathPrefix: '/oracle23ai/',
  dir: {
    input: "src",
    includes: "_includes",
    data: "_data",
    output: "_site"
  },
  templateFormats: ["njk", "md", "html"],
  markdownTemplateEngine: "njk",
  htmlTemplateEngine: "njk"
};
};
