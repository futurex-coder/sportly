import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  decimal,
  timestamp,
  time,
  date,
  doublePrecision,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

// ─── ENUMS ──────────────────────────────────────────────────

export const userRoleEnum = pgEnum('user_role', [
  'super_admin',
  'club_admin',
  'staff',
  'trainer',
  'client',
]);

export const sessionVisibilityEnum = pgEnum('session_visibility', [
  'public',
  'private',
]);

export const bookingStatusEnum = pgEnum('booking_status', [
  'pending',
  'confirmed',
  'cancelled',
  'completed',
]);

export const dayOfWeekEnum = pgEnum('day_of_week', [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]);

export const participantStatusEnum = pgEnum('session_participant_status', [
  'invited',
  'requested',
  'confirmed',
  'declined',
  'waitlisted',
]);

// ─── TABLES ─────────────────────────────────────────────────

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    email: text('email').notNull(),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
    phone: text('phone'),
    city: text('city'),
    role: userRoleEnum('role').notNull().default('client'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_profiles_role').on(table.role),
    index('idx_profiles_city').on(table.city),
  ]
);

export const sportCategories = pgTable('sport_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  icon: text('icon'),
  colorPrimary: text('color_primary'),
  colorAccent: text('color_accent'),
  description: text('description'),
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const clubs = pgTable(
  'clubs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    description: text('description'),
    logoUrl: text('logo_url'),
    coverImageUrl: text('cover_image_url'),
    website: text('website'),
    email: text('email'),
    phone: text('phone'),
    city: text('city'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [index('idx_clubs_active').on(table.isActive)]
);

export const clubMembers = pgTable(
  'club_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: userRoleEnum('role').notNull(),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('club_members_club_id_user_id_key').on(
      table.clubId,
      table.userId
    ),
    index('idx_club_members_user').on(table.userId),
    index('idx_club_members_club').on(table.clubId),
  ]
);

export const locations = pgTable(
  'locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clubId: uuid('club_id')
      .notNull()
      .references(() => clubs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    address: text('address').notNull(),
    city: text('city').notNull(),
    country: text('country').default('Bulgaria'),
    postalCode: text('postal_code'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    phone: text('phone'),
    email: text('email'),
    description: text('description'),
    coverImageUrl: text('cover_image_url'),
    isActive: boolean('is_active').default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('locations_club_id_slug_key').on(table.clubId, table.slug),
    index('idx_locations_club').on(table.clubId),
    index('idx_locations_city').on(table.city),
  ]
);

export const locationSchedules = pgTable(
  'location_schedules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    dayOfWeek: dayOfWeekEnum('day_of_week').notNull(),
    openTime: time('open_time').notNull(),
    closeTime: time('close_time').notNull(),
    isClosed: boolean('is_closed').default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('location_schedules_location_id_day_key').on(
      table.locationId,
      table.dayOfWeek
    ),
  ]
);

export const locationImages = pgTable('location_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id')
    .notNull()
    .references(() => locations.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  caption: text('caption'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const fields = pgTable(
  'fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.id, { onDelete: 'cascade' }),
    sportCategoryId: uuid('sport_category_id')
      .notNull()
      .references(() => sportCategories.id),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    coverImageUrl: text('cover_image_url'),
    isActive: boolean('is_active').default(true),
    sortOrder: integer('sort_order').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('fields_location_id_slug_key').on(
      table.locationId,
      table.slug
    ),
    index('idx_fields_location').on(table.locationId),
    index('idx_fields_sport').on(table.sportCategoryId),
  ]
);

export const fieldAttributes = pgTable(
  'field_attributes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'cascade' }),
    attributeKey: text('attribute_key').notNull(),
    attributeValue: text('attribute_value').notNull(),
  },
  (table) => [
    uniqueIndex('field_attributes_field_id_key_key').on(
      table.fieldId,
      table.attributeKey
    ),
    index('idx_field_attributes_field').on(table.fieldId),
  ]
);

export const fieldBookingSettings = pgTable('field_booking_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id')
    .notNull()
    .references(() => fields.id, { onDelete: 'cascade' })
    .unique(),
  slotDurationMinutes: integer('slot_duration_minutes').notNull().default(60),
  bufferMinutes: integer('buffer_minutes').default(0),
  pricePerSlotEur: decimal('price_per_slot_eur', {
    precision: 10,
    scale: 2,
  })
    .notNull()
    .default('0'),
  pricePerSlotLocal: decimal('price_per_slot_local', {
    precision: 10,
    scale: 2,
  }),
  currencyLocal: text('currency_local').default('BGN'),
  minBookingNoticeHours: integer('min_booking_notice_hours').default(1),
  maxBookingAdvanceDays: integer('max_booking_advance_days').default(30),
  allowRecurring: boolean('allow_recurring').default(false),
  maxConcurrentBookings: integer('max_concurrent_bookings').default(1),
  cancellationPolicyHours: integer('cancellation_policy_hours').default(24),
  autoConfirm: boolean('auto_confirm').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const fieldAvailability = pgTable('field_availability', {
  id: uuid('id').primaryKey().defaultRandom(),
  fieldId: uuid('field_id')
    .notNull()
    .references(() => fields.id, { onDelete: 'cascade' }),
  dayOfWeek: dayOfWeekEnum('day_of_week'),
  specificDate: date('specific_date'),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  isAvailable: boolean('is_available').default(true),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id),
    sessionId: uuid('session_id').references(() => groupSessions.id, { onDelete: 'set null' }),
    date: date('date').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    status: bookingStatusEnum('status').notNull().default('confirmed'),
    totalPriceEur: decimal('total_price_eur', { precision: 10, scale: 2 }),
    totalPriceLocal: decimal('total_price_local', { precision: 10, scale: 2 }),
    notes: text('notes'),
    bookedBy: uuid('booked_by').references(() => profiles.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_bookings_field_date').on(table.fieldId, table.date),
    index('idx_bookings_user').on(table.userId),
    index('idx_bookings_status').on(table.status),
  ]
);

export const groupSessions = pgTable(
  'group_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fieldId: uuid('field_id')
      .notNull()
      .references(() => fields.id, { onDelete: 'cascade' }),
    bookingId: uuid('booking_id').references(() => bookings.id, {
      onDelete: 'set null',
    }),
    organizerId: uuid('organizer_id')
      .notNull()
      .references(() => profiles.id),
    sportCategoryId: uuid('sport_category_id')
      .notNull()
      .references(() => sportCategories.id),
    title: text('title').notNull(),
    description: text('description'),
    visibility: sessionVisibilityEnum('visibility')
      .notNull()
      .default('public'),
    date: date('date').notNull(),
    startTime: time('start_time').notNull(),
    endTime: time('end_time').notNull(),
    maxParticipants: integer('max_participants').notNull().default(10),
    currentParticipants: integer('current_participants').notNull().default(0),
    pricePerPersonEur: decimal('price_per_person_eur', {
      precision: 10,
      scale: 2,
    }).default('0'),
    pricePerPersonLocal: decimal('price_per_person_local', {
      precision: 10,
      scale: 2,
    }).default('0'),
    skillLevelMin: decimal('skill_level_min', {
      precision: 3,
      scale: 1,
    }).default('0'),
    skillLevelMax: decimal('skill_level_max', {
      precision: 3,
      scale: 1,
    }).default('5'),
    isConfirmed: boolean('is_confirmed').default(false),
    confirmationDeadline: timestamp('confirmation_deadline', {
      withTimezone: true,
    }),
    cancelledReason: text('cancelled_reason'),
    isCancelled: boolean('is_cancelled').default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    index('idx_sessions_field_date').on(table.fieldId, table.date),
    index('idx_sessions_sport').on(table.sportCategoryId),
    index('idx_sessions_visibility').on(table.visibility),
    index('idx_sessions_organizer').on(table.organizerId),
    index('idx_sessions_confirmed').on(table.isConfirmed),
    index('idx_sessions_deadline').on(table.confirmationDeadline),
  ]
);

export const sessionParticipants = pgTable(
  'session_participants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => groupSessions.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id),
    status: participantStatusEnum('status').notNull().default('confirmed'),
    invitedBy: uuid('invited_by').references(() => profiles.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('session_participants_session_user_key').on(
      table.sessionId,
      table.userId
    ),
    index('idx_session_participants_user').on(table.userId),
    index('idx_session_participants_session').on(table.sessionId),
    index('idx_session_participants_status').on(table.sessionId, table.status),
  ]
);

export const sessionInvites = pgTable('session_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => groupSessions.id, { onDelete: 'cascade' }),
  invitedEmail: text('invited_email'),
  invitedUserId: uuid('invited_user_id').references(() => profiles.id),
  inviteCode: text('invite_code').unique(),
  status: text('status').default('pending'),
  acceptedBy: uuid('accepted_by').references(() => profiles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const userSportRankings = pgTable(
  'user_sport_rankings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    sportCategoryId: uuid('sport_category_id')
      .notNull()
      .references(() => sportCategories.id),
    rating: decimal('rating', { precision: 3, scale: 1 })
      .notNull()
      .default('3.0'),
    totalRatingsReceived: integer('total_ratings_received').default(0),
    totalSessionsPlayed: integer('total_sessions_played').default(0),
    wins: integer('wins').default(0),
    losses: integer('losses').default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('user_sport_rankings_user_sport_key').on(
      table.userId,
      table.sportCategoryId
    ),
    index('idx_user_sport_rankings_user').on(table.userId),
    index('idx_user_sport_rankings_sport').on(table.sportCategoryId),
    index('idx_user_sport_rankings_rating').on(table.rating),
  ]
);

export const userRatings = pgTable(
  'user_ratings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    raterId: uuid('rater_id')
      .notNull()
      .references(() => profiles.id),
    ratedId: uuid('rated_id')
      .notNull()
      .references(() => profiles.id),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => groupSessions.id),
    sportCategoryId: uuid('sport_category_id')
      .notNull()
      .references(() => sportCategories.id),
    rating: integer('rating').notNull(),
    skillRating: integer('skill_rating'),
    sportsmanshipRating: integer('sportsmanship_rating'),
    comment: text('comment'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  },
  (table) => [
    uniqueIndex('user_ratings_rater_rated_session_key').on(
      table.raterId,
      table.ratedId,
      table.sessionId
    ),
    index('idx_user_ratings_rated').on(table.ratedId),
    index('idx_user_ratings_session').on(table.sessionId),
  ]
);

export const ratingCriteria = pgTable('rating_criteria', {
  id: uuid('id').primaryKey().defaultRandom(),
  sportCategoryId: uuid('sport_category_id').references(
    () => sportCategories.id
  ),
  name: text('name').notNull(),
  description: text('description'),
  weight: decimal('weight', { precision: 3, scale: 2 }).default('1.0'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
});

export const userRatingDetails = pgTable(
  'user_rating_details',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userRatingId: uuid('user_rating_id')
      .notNull()
      .references(() => userRatings.id, { onDelete: 'cascade' }),
    criteriaId: uuid('criteria_id')
      .notNull()
      .references(() => ratingCriteria.id),
    score: integer('score').notNull(),
  },
  (table) => [
    uniqueIndex('user_rating_details_rating_criteria_key').on(
      table.userRatingId,
      table.criteriaId
    ),
  ]
);

// ─── RELATIONS ──────────────────────────────────────────────

export const profilesRelations = relations(profiles, ({ many }) => ({
  clubMemberships: many(clubMembers),
  bookings: many(bookings),
  organizedSessions: many(groupSessions),
  sessionParticipations: many(sessionParticipants),
  sportRankings: many(userSportRankings),
  ratingsGiven: many(userRatings, { relationName: 'rater' }),
  ratingsReceived: many(userRatings, { relationName: 'rated' }),
}));

export const sportCategoriesRelations = relations(
  sportCategories,
  ({ many }) => ({
    fields: many(fields),
    groupSessions: many(groupSessions),
    userSportRankings: many(userSportRankings),
    ratingCriteria: many(ratingCriteria),
  })
);

export const clubsRelations = relations(clubs, ({ many }) => ({
  members: many(clubMembers),
  locations: many(locations),
}));

export const clubMembersRelations = relations(clubMembers, ({ one }) => ({
  club: one(clubs, { fields: [clubMembers.clubId], references: [clubs.id] }),
  user: one(profiles, {
    fields: [clubMembers.userId],
    references: [profiles.id],
  }),
}));

export const locationsRelations = relations(locations, ({ one, many }) => ({
  club: one(clubs, { fields: [locations.clubId], references: [clubs.id] }),
  schedules: many(locationSchedules),
  images: many(locationImages),
  fields: many(fields),
}));

export const locationSchedulesRelations = relations(
  locationSchedules,
  ({ one }) => ({
    location: one(locations, {
      fields: [locationSchedules.locationId],
      references: [locations.id],
    }),
  })
);

export const locationImagesRelations = relations(
  locationImages,
  ({ one }) => ({
    location: one(locations, {
      fields: [locationImages.locationId],
      references: [locations.id],
    }),
  })
);

export const fieldsRelations = relations(fields, ({ one, many }) => ({
  location: one(locations, {
    fields: [fields.locationId],
    references: [locations.id],
  }),
  sportCategory: one(sportCategories, {
    fields: [fields.sportCategoryId],
    references: [sportCategories.id],
  }),
  attributes: many(fieldAttributes),
  bookingSettings: many(fieldBookingSettings),
  availability: many(fieldAvailability),
  bookings: many(bookings),
  groupSessions: many(groupSessions),
}));

export const fieldAttributesRelations = relations(
  fieldAttributes,
  ({ one }) => ({
    field: one(fields, {
      fields: [fieldAttributes.fieldId],
      references: [fields.id],
    }),
  })
);

export const fieldBookingSettingsRelations = relations(
  fieldBookingSettings,
  ({ one }) => ({
    field: one(fields, {
      fields: [fieldBookingSettings.fieldId],
      references: [fields.id],
    }),
  })
);

export const fieldAvailabilityRelations = relations(
  fieldAvailability,
  ({ one }) => ({
    field: one(fields, {
      fields: [fieldAvailability.fieldId],
      references: [fields.id],
    }),
  })
);

export const bookingsRelations = relations(bookings, ({ one }) => ({
  field: one(fields, { fields: [bookings.fieldId], references: [fields.id] }),
  user: one(profiles, {
    fields: [bookings.userId],
    references: [profiles.id],
  }),
  session: one(groupSessions, {
    fields: [bookings.sessionId],
    references: [groupSessions.id],
  }),
  bookedByUser: one(profiles, {
    fields: [bookings.bookedBy],
    references: [profiles.id],
    relationName: 'bookedBy',
  }),
}));

export const groupSessionsRelations = relations(
  groupSessions,
  ({ one, many }) => ({
    field: one(fields, {
      fields: [groupSessions.fieldId],
      references: [fields.id],
    }),
    booking: one(bookings, {
      fields: [groupSessions.bookingId],
      references: [bookings.id],
    }),
    organizer: one(profiles, {
      fields: [groupSessions.organizerId],
      references: [profiles.id],
    }),
    sportCategory: one(sportCategories, {
      fields: [groupSessions.sportCategoryId],
      references: [sportCategories.id],
    }),
    participants: many(sessionParticipants),
    invites: many(sessionInvites),
    ratings: many(userRatings),
  })
);

export const sessionParticipantsRelations = relations(
  sessionParticipants,
  ({ one }) => ({
    session: one(groupSessions, {
      fields: [sessionParticipants.sessionId],
      references: [groupSessions.id],
    }),
    user: one(profiles, {
      fields: [sessionParticipants.userId],
      references: [profiles.id],
    }),
    invitedByUser: one(profiles, {
      fields: [sessionParticipants.invitedBy],
      references: [profiles.id],
      relationName: 'invitedBy',
    }),
  })
);

export const sessionInvitesRelations = relations(
  sessionInvites,
  ({ one }) => ({
    session: one(groupSessions, {
      fields: [sessionInvites.sessionId],
      references: [groupSessions.id],
    }),
    invitedUser: one(profiles, {
      fields: [sessionInvites.invitedUserId],
      references: [profiles.id],
    }),
  })
);

export const userSportRankingsRelations = relations(
  userSportRankings,
  ({ one }) => ({
    user: one(profiles, {
      fields: [userSportRankings.userId],
      references: [profiles.id],
    }),
    sportCategory: one(sportCategories, {
      fields: [userSportRankings.sportCategoryId],
      references: [sportCategories.id],
    }),
  })
);

export const userRatingsRelations = relations(
  userRatings,
  ({ one, many }) => ({
    rater: one(profiles, {
      fields: [userRatings.raterId],
      references: [profiles.id],
      relationName: 'rater',
    }),
    rated: one(profiles, {
      fields: [userRatings.ratedId],
      references: [profiles.id],
      relationName: 'rated',
    }),
    session: one(groupSessions, {
      fields: [userRatings.sessionId],
      references: [groupSessions.id],
    }),
    sportCategory: one(sportCategories, {
      fields: [userRatings.sportCategoryId],
      references: [sportCategories.id],
    }),
    details: many(userRatingDetails),
  })
);

export const ratingCriteriaRelations = relations(
  ratingCriteria,
  ({ one }) => ({
    sportCategory: one(sportCategories, {
      fields: [ratingCriteria.sportCategoryId],
      references: [sportCategories.id],
    }),
  })
);

export const userRatingDetailsRelations = relations(
  userRatingDetails,
  ({ one }) => ({
    userRating: one(userRatings, {
      fields: [userRatingDetails.userRatingId],
      references: [userRatings.id],
    }),
    criteria: one(ratingCriteria, {
      fields: [userRatingDetails.criteriaId],
      references: [ratingCriteria.id],
    }),
  })
);
