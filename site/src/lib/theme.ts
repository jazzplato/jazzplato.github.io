// RELEASE_ENV=staging (next and staging hosts) keeps search engines off a copy; production is the default.
export const PREVIEW_HOST = (process.env.RELEASE_ENV || 'production') !== 'production';
