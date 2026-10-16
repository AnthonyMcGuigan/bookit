
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "account_restrictions": {
                  Row: {
                    "created_at": string,"created_by": string | null,"ends_at": string | null,"id": string,"kind": string,"lifted_at": string | null,"lifted_by": string | null,"reason": string,"starts_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"kind": string,"lifted_at"?: string | null,"lifted_by"?: string | null,"reason": string,"starts_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: string,"kind"?: string,"lifted_at"?: string | null,"lifted_by"?: string | null,"reason"?: string,"starts_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"app_config": {
                  Row: {
                    "auto_hide_report_threshold": number,"community_moderation_mode": string,"dev_entitlements_enabled": boolean,"flagged_terms": (string)[],"id": boolean,"review_creations_with_images": boolean,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_hide_report_threshold"?: number,"community_moderation_mode"?: string,"dev_entitlements_enabled"?: boolean,"flagged_terms"?: (string)[],"id"?: boolean,"review_creations_with_images"?: boolean,"updated_at"?: string
                  }
                  Update: {
                    "auto_hide_report_threshold"?: number,"community_moderation_mode"?: string,"dev_entitlements_enabled"?: boolean,"flagged_terms"?: (string)[],"id"?: boolean,"review_creations_with_images"?: boolean,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"appeals": {
                  Row: {
                    "appellant_id": string,"created_at": string,"creation_id": string,"handled_at": string | null,"handled_by": string | null,"id": string,"message": string,"moderator_note": string | null,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appellant_id"?: string,"created_at"?: string,"creation_id": string,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"message": string,"moderator_note"?: string | null,"status"?: string
                  }
                  Update: {
                    "appellant_id"?: string,"created_at"?: string,"creation_id"?: string,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"message"?: string,"moderator_note"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "appeals_creation_id_fkey"
      columns: ["creation_id"]
isOneToOne: false
      referencedRelation: "community_creations"
      referencedColumns: ["id"]
    }
                  ]
                },"billing_customers": {
                  Row: {
                    "created_at": string,"provider": string,"provider_customer_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"provider": string,"provider_customer_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"provider"?: string,"provider_customer_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"billing_events": {
                  Row: {
                    "created_at": string,"event_type": string,"id": string,"payload": NonNullable<Json>,"processed_at": string | null,"provider": string,"provider_event_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"event_type": string,"id"?: string,"payload": NonNullable<Json>,"processed_at"?: string | null,"provider": string,"provider_event_id": string
                  }
                  Update: {
                    "created_at"?: string,"event_type"?: string,"id"?: string,"payload"?: NonNullable<Json>,"processed_at"?: string | null,"provider"?: string,"provider_event_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"business_deals": {
                  Row: {
                    "amount_per_show": number,"applies_to": (string)[],"created_at": string,"ends_on": string,"id": string,"kind": string,"partner_name": string,"promotion_id": string,"starts_on": string,"status": string,"universe_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_per_show": number,"applies_to"?: (string)[],"created_at"?: string,"ends_on": string,"id"?: string,"kind": string,"partner_name": string,"promotion_id": string,"starts_on": string,"status"?: string,"universe_id": string,"updated_at"?: string
                  }
                  Update: {
                    "amount_per_show"?: number,"applies_to"?: (string)[],"created_at"?: string,"ends_on"?: string,"id"?: string,"kind"?: string,"partner_name"?: string,"promotion_id"?: string,"starts_on"?: string,"status"?: string,"universe_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "business_deals_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "business_deals_universe_id_promotion_id_fkey"
      columns: ["universe_id","promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"championships": {
                  Row: {
                    "created_at": string,"description": string,"division": string,"eligibility": NonNullable<Json>,"established_on": string,"format": string,"id": string,"image_asset_id": string | null,"name": string,"prestige": number,"promotion_id": string,"retired_on": string | null,"sort_order": number,"status": string,"tier": string,"universe_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"division"?: string,"eligibility"?: NonNullable<Json>,"established_on": string,"format"?: string,"id"?: string,"image_asset_id"?: string | null,"name": string,"prestige"?: number,"promotion_id": string,"retired_on"?: string | null,"sort_order"?: number,"status"?: string,"tier"?: string,"universe_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"division"?: string,"eligibility"?: NonNullable<Json>,"established_on"?: string,"format"?: string,"id"?: string,"image_asset_id"?: string | null,"name"?: string,"prestige"?: number,"promotion_id"?: string,"retired_on"?: string | null,"sort_order"?: number,"status"?: string,"tier"?: string,"universe_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "championships_image_asset_id_fkey"
      columns: ["image_asset_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "championships_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "championships_universe_id_promotion_id_fkey"
      columns: ["universe_id","promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"chemistry": {
                  Row: {
                    "matches_against": number,"matches_together": number,"opponent_score": number,"partner_score": number,"universe_id": string,"updated_at": string,"wrestler_a": string,"wrestler_b": string
                  }
                  ComputedFields: never
                  Insert: {
                    "matches_against"?: number,"matches_together"?: number,"opponent_score"?: number,"partner_score"?: number,"universe_id": string,"updated_at"?: string,"wrestler_a": string,"wrestler_b": string
                  }
                  Update: {
                    "matches_against"?: number,"matches_together"?: number,"opponent_score"?: number,"partner_score"?: number,"universe_id"?: string,"updated_at"?: string,"wrestler_a"?: string,"wrestler_b"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "chemistry_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "chemistry_universe_id_wrestler_a_fkey"
      columns: ["universe_id","wrestler_a"]
isOneToOne: false
      referencedRelation: "wrestlers"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "chemistry_universe_id_wrestler_b_fkey"
      columns: ["universe_id","wrestler_b"]
isOneToOne: false
      referencedRelation: "wrestlers"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"community_creations": {
                  Row: {
                    "allow_derivatives": boolean,"category": string,"created_at": string,"current_version": number,"description": string,"download_count": number,"id": string,"is_fan_content": boolean,"lineage": NonNullable<Json>,"moderation_reason": string | null,"moderation_state": string,"owner_id": string,"published_at": string | null,"rating_count": number,"rating_sum": number,"report_count": number,"source_creation_id": string | null,"source_version": number | null,"summary": string,"tags": (string)[],"thumbnail_asset_id": string | null,"title": string,"updated_at": string,"visibility": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allow_derivatives"?: boolean,"category": string,"created_at"?: string,"current_version"?: number,"description"?: string,"download_count"?: number,"id"?: string,"is_fan_content"?: boolean,"lineage"?: NonNullable<Json>,"moderation_reason"?: string | null,"moderation_state"?: string,"owner_id": string,"published_at"?: string | null,"rating_count"?: number,"rating_sum"?: number,"report_count"?: number,"source_creation_id"?: string | null,"source_version"?: number | null,"summary"?: string,"tags"?: (string)[],"thumbnail_asset_id"?: string | null,"title": string,"updated_at"?: string,"visibility"?: string
                  }
                  Update: {
                    "allow_derivatives"?: boolean,"category"?: string,"created_at"?: string,"current_version"?: number,"description"?: string,"download_count"?: number,"id"?: string,"is_fan_content"?: boolean,"lineage"?: NonNullable<Json>,"moderation_reason"?: string | null,"moderation_state"?: string,"owner_id"?: string,"published_at"?: string | null,"rating_count"?: number,"rating_sum"?: number,"report_count"?: number,"source_creation_id"?: string | null,"source_version"?: number | null,"summary"?: string,"tags"?: (string)[],"thumbnail_asset_id"?: string | null,"title"?: string,"updated_at"?: string,"visibility"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "community_creations_source_creation_id_fkey"
      columns: ["source_creation_id"]
isOneToOne: false
      referencedRelation: "community_creations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "community_creations_thumbnail_asset_id_fkey"
      columns: ["thumbnail_asset_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    }
                  ]
                },"contracts": {
                  Row: {
                    "appearance_fee": number,"created_at": string,"ends_on": string,"exclusive": boolean,"id": string,"promotion_id": string,"starts_on": string,"status": string,"universe_id": string,"updated_at": string,"weekly_salary": number,"wrestler_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "appearance_fee"?: number,"created_at"?: string,"ends_on": string,"exclusive"?: boolean,"id"?: string,"promotion_id": string,"starts_on": string,"status"?: string,"universe_id": string,"updated_at"?: string,"weekly_salary"?: number,"wrestler_id": string
                  }
                  Update: {
                    "appearance_fee"?: number,"created_at"?: string,"ends_on"?: string,"exclusive"?: boolean,"id"?: string,"promotion_id"?: string,"starts_on"?: string,"status"?: string,"universe_id"?: string,"updated_at"?: string,"weekly_salary"?: number,"wrestler_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "contracts_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "contracts_universe_id_promotion_id_fkey"
      columns: ["universe_id","promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "contracts_universe_id_wrestler_id_fkey"
      columns: ["universe_id","wrestler_id"]
isOneToOne: false
      referencedRelation: "wrestlers"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"creation_downloads": {
                  Row: {
                    "creation_id": string,"first_downloaded_at": string,"last_downloaded_at": string,"user_id": string,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "creation_id": string,"first_downloaded_at"?: string,"last_downloaded_at"?: string,"user_id": string,"version": number
                  }
                  Update: {
                    "creation_id"?: string,"first_downloaded_at"?: string,"last_downloaded_at"?: string,"user_id"?: string,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "creation_downloads_creation_id_fkey"
      columns: ["creation_id"]
isOneToOne: false
      referencedRelation: "community_creations"
      referencedColumns: ["id"]
    }
                  ]
                },"creation_ratings": {
                  Row: {
                    "created_at": string,"creation_id": string,"stars": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"creation_id": string,"stars": number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"creation_id"?: string,"stars"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "creation_ratings_creation_id_fkey"
      columns: ["creation_id"]
isOneToOne: false
      referencedRelation: "community_creations"
      referencedColumns: ["id"]
    }
                  ]
                },"creation_versions": {
                  Row: {
                    "changelog": string,"created_at": string,"creation_id": string,"entity_counts": NonNullable<Json>,"id": string,"media_asset_ids": (string)[],"package": NonNullable<Json>,"package_bytes": number,"package_schema_version": number,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "changelog"?: string,"created_at"?: string,"creation_id": string,"entity_counts"?: NonNullable<Json>,"id"?: string,"media_asset_ids"?: (string)[],"package": NonNullable<Json>,"package_bytes": number,"package_schema_version": number,"version": number
                  }
                  Update: {
                    "changelog"?: string,"created_at"?: string,"creation_id"?: string,"entity_counts"?: NonNullable<Json>,"id"?: string,"media_asset_ids"?: (string)[],"package"?: NonNullable<Json>,"package_bytes"?: number,"package_schema_version"?: number,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "creation_versions_creation_id_fkey"
      columns: ["creation_id"]
isOneToOne: false
      referencedRelation: "community_creations"
      referencedColumns: ["id"]
    }
                  ]
                },"entitlements": {
                  Row: {
                    "auto_renews": boolean,"created_at": string,"expires_at": string | null,"id": string,"note": string | null,"plan": string,"provider": string | null,"provider_reference": string | null,"source": string,"starts_at": string,"status": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_renews"?: boolean,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"note"?: string | null,"plan"?: string,"provider"?: string | null,"provider_reference"?: string | null,"source": string,"starts_at"?: string,"status"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "auto_renews"?: boolean,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"note"?: string | null,"plan"?: string,"provider"?: string | null,"provider_reference"?: string | null,"source"?: string,"starts_at"?: string,"status"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"financial_transactions": {
                  Row: {
                    "amount": number,"category": string,"created_at": string,"description": string,"id": string,"occurred_on": string,"promotion_id": string,"show_id": string | null,"universe_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"category": string,"created_at"?: string,"description"?: string,"id"?: string,"occurred_on": string,"promotion_id": string,"show_id"?: string | null,"universe_id": string
                  }
                  Update: {
                    "amount"?: number,"category"?: string,"created_at"?: string,"description"?: string,"id"?: string,"occurred_on"?: string,"promotion_id"?: string,"show_id"?: string | null,"universe_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "financial_transactions_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "financial_transactions_universe_id_promotion_id_fkey"
      columns: ["universe_id","promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "financial_transactions_universe_id_show_id_fkey"
      columns: ["universe_id","show_id"]
isOneToOne: false
      referencedRelation: "shows"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"injuries": {
                  Row: {
                    "created_at": string,"description": string,"expected_return_on": string,"healed_on": string | null,"id": string,"is_storyline": boolean,"segment_id": string | null,"severity": string,"started_on": string,"universe_id": string,"updated_at": string,"wrestler_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description": string,"expected_return_on": string,"healed_on"?: string | null,"id"?: string,"is_storyline"?: boolean,"segment_id"?: string | null,"severity"?: string,"started_on": string,"universe_id": string,"updated_at"?: string,"wrestler_id": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"expected_return_on"?: string,"healed_on"?: string | null,"id"?: string,"is_storyline"?: boolean,"segment_id"?: string | null,"severity"?: string,"started_on"?: string,"universe_id"?: string,"updated_at"?: string,"wrestler_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "injuries_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "injuries_universe_id_segment_id_fkey"
      columns: ["universe_id","segment_id"]
isOneToOne: false
      referencedRelation: "segments"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "injuries_universe_id_wrestler_id_fkey"
      columns: ["universe_id","wrestler_id"]
isOneToOne: false
      referencedRelation: "wrestlers"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"ip_takedown_requests": {
                  Row: {
                    "accuracy_statement": boolean,"claimant_email": string,"claimant_name": string,"claimant_organization": string,"created_at": string,"creation_id": string | null,"good_faith_statement": boolean,"handled_at": string | null,"handled_by": string | null,"id": string,"infringing_url": string,"moderator_note": string | null,"rights_holder_relationship": string,"signature": string,"status": string,"submitted_by": string | null,"work_description": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy_statement": boolean,"claimant_email": string,"claimant_name": string,"claimant_organization"?: string,"created_at"?: string,"creation_id"?: string | null,"good_faith_statement": boolean,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"infringing_url": string,"moderator_note"?: string | null,"rights_holder_relationship": string,"signature": string,"status"?: string,"submitted_by"?: string | null,"work_description": string
                  }
                  Update: {
                    "accuracy_statement"?: boolean,"claimant_email"?: string,"claimant_name"?: string,"claimant_organization"?: string,"created_at"?: string,"creation_id"?: string | null,"good_faith_statement"?: boolean,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"infringing_url"?: string,"moderator_note"?: string | null,"rights_holder_relationship"?: string,"signature"?: string,"status"?: string,"submitted_by"?: string | null,"work_description"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ip_takedown_requests_creation_id_fkey"
      columns: ["creation_id"]
isOneToOne: false
      referencedRelation: "community_creations"
      referencedColumns: ["id"]
    }
                  ]
                },"media_assets": {
                  Row: {
                    "bucket": string,"bytes": number,"created_at": string,"deleted_at": string | null,"height": number,"id": string,"kind": string,"mime_type": string,"original_filename": string | null,"owner_id": string,"sha256": string,"source_asset_id": string | null,"status": string,"storage_path": string,"thumb_bytes": number,"thumb_path": string | null,"width": number
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket": string,"bytes": number,"created_at"?: string,"deleted_at"?: string | null,"height": number,"id"?: string,"kind": string,"mime_type": string,"original_filename"?: string | null,"owner_id": string,"sha256": string,"source_asset_id"?: string | null,"status"?: string,"storage_path": string,"thumb_bytes"?: number,"thumb_path"?: string | null,"width": number
                  }
                  Update: {
                    "bucket"?: string,"bytes"?: number,"created_at"?: string,"deleted_at"?: string | null,"height"?: number,"id"?: string,"kind"?: string,"mime_type"?: string,"original_filename"?: string | null,"owner_id"?: string,"sha256"?: string,"source_asset_id"?: string | null,"status"?: string,"storage_path"?: string,"thumb_bytes"?: number,"thumb_path"?: string | null,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "media_assets_source_asset_id_fkey"
      columns: ["source_asset_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    }
                  ]
                },"moderation_actions": {
                  Row: {
                    "action": string,"created_at": string,"creation_id": string | null,"id": string,"metadata": NonNullable<Json>,"moderator_id": string | null,"reason": string,"report_id": string | null,"target_user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"creation_id"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"moderator_id"?: string | null,"reason": string,"report_id"?: string | null,"target_user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"creation_id"?: string | null,"id"?: string,"metadata"?: NonNullable<Json>,"moderator_id"?: string | null,"reason"?: string,"report_id"?: string | null,"target_user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "moderation_actions_creation_id_fkey"
      columns: ["creation_id"]
isOneToOne: false
      referencedRelation: "community_creations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "moderation_actions_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "reports"
      referencedColumns: ["id"]
    }
                  ]
                },"plan_limits": {
                  Row: {
                    "description": string,"feature": string,"limit_value": number,"plan": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description": string,"feature": string,"limit_value": number,"plan": string
                  }
                  Update: {
                    "description"?: string,"feature"?: string,"limit_value"?: number,"plan"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "bio": string,"created_at": string,"display_name": string,"handle": string,"id": string,"updated_at": string,"website_url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "bio"?: string,"created_at"?: string,"display_name": string,"handle": string,"id": string,"updated_at"?: string,"website_url"?: string | null
                  }
                  Update: {
                    "bio"?: string,"created_at"?: string,"display_name"?: string,"handle"?: string,"id"?: string,"updated_at"?: string,"website_url"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"promotions": {
                  Row: {
                    "abbreviation": string,"archived_at": string | null,"audience_profile": string,"cash_balance": number,"controlled_by": string,"created_at": string,"description": string,"founded_on": string | null,"id": string,"logo_asset_id": string | null,"name": string,"popularity": number,"primary_color": string,"region": string,"reputation": number,"secondary_color": string,"tagline": string,"universe_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "abbreviation": string,"archived_at"?: string | null,"audience_profile"?: string,"cash_balance"?: number,"controlled_by"?: string,"created_at"?: string,"description"?: string,"founded_on"?: string | null,"id"?: string,"logo_asset_id"?: string | null,"name": string,"popularity"?: number,"primary_color"?: string,"region"?: string,"reputation"?: number,"secondary_color"?: string,"tagline"?: string,"universe_id": string,"updated_at"?: string
                  }
                  Update: {
                    "abbreviation"?: string,"archived_at"?: string | null,"audience_profile"?: string,"cash_balance"?: number,"controlled_by"?: string,"created_at"?: string,"description"?: string,"founded_on"?: string | null,"id"?: string,"logo_asset_id"?: string | null,"name"?: string,"popularity"?: number,"primary_color"?: string,"region"?: string,"reputation"?: number,"secondary_color"?: string,"tagline"?: string,"universe_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "promotions_logo_asset_id_fkey"
      columns: ["logo_asset_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "promotions_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    }
                  ]
                },"rate_limit_events": {
                  Row: {
                    "action": string,"created_at": string,"id": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"created_at"?: string,"id"?: never,"user_id": string
                  }
                  Update: {
                    "action"?: string,"created_at"?: string,"id"?: never,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "category": string,"created_at": string,"creation_id": string | null,"details": string,"handled_at": string | null,"handled_by": string | null,"id": string,"reported_user_id": string | null,"reporter_id": string,"resolution_note": string | null,"status": string,"target_type": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"created_at"?: string,"creation_id"?: string | null,"details"?: string,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"reported_user_id"?: string | null,"reporter_id"?: string,"resolution_note"?: string | null,"status"?: string,"target_type": string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"creation_id"?: string | null,"details"?: string,"handled_at"?: string | null,"handled_by"?: string | null,"id"?: string,"reported_user_id"?: string | null,"reporter_id"?: string,"resolution_note"?: string | null,"status"?: string,"target_type"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "reports_creation_id_fkey"
      columns: ["creation_id"]
isOneToOne: false
      referencedRelation: "community_creations"
      referencedColumns: ["id"]
    }
                  ]
                },"rivalries": {
                  Row: {
                    "created_at": string,"ended_on": string | null,"id": string,"intensity": number,"last_interaction_on": string,"matches": number,"started_on": string,"storyline_id": string | null,"universe_id": string,"updated_at": string,"wrestler_a": string,"wrestler_b": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ended_on"?: string | null,"id"?: string,"intensity"?: number,"last_interaction_on": string,"matches"?: number,"started_on": string,"storyline_id"?: string | null,"universe_id": string,"updated_at"?: string,"wrestler_a": string,"wrestler_b": string
                  }
                  Update: {
                    "created_at"?: string,"ended_on"?: string | null,"id"?: string,"intensity"?: number,"last_interaction_on"?: string,"matches"?: number,"started_on"?: string,"storyline_id"?: string | null,"universe_id"?: string,"updated_at"?: string,"wrestler_a"?: string,"wrestler_b"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "rivalries_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "rivalries_universe_id_storyline_id_fkey"
      columns: ["universe_id","storyline_id"]
isOneToOne: false
      referencedRelation: "storylines"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "rivalries_universe_id_wrestler_a_fkey"
      columns: ["universe_id","wrestler_a"]
isOneToOne: false
      referencedRelation: "wrestlers"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "rivalries_universe_id_wrestler_b_fkey"
      columns: ["universe_id","wrestler_b"]
isOneToOne: false
      referencedRelation: "wrestlers"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"roster_memberships": {
                  Row: {
                    "created_at": string,"end_reason": string | null,"ended_on": string | null,"id": string,"promotion_id": string,"started_on": string,"universe_id": string,"updated_at": string,"wrestler_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"end_reason"?: string | null,"ended_on"?: string | null,"id"?: string,"promotion_id": string,"started_on": string,"universe_id": string,"updated_at"?: string,"wrestler_id": string
                  }
                  Update: {
                    "created_at"?: string,"end_reason"?: string | null,"ended_on"?: string | null,"id"?: string,"promotion_id"?: string,"started_on"?: string,"universe_id"?: string,"updated_at"?: string,"wrestler_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "roster_memberships_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "roster_memberships_universe_id_promotion_id_fkey"
      columns: ["universe_id","promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "roster_memberships_universe_id_wrestler_id_fkey"
      columns: ["universe_id","wrestler_id"]
isOneToOne: false
      referencedRelation: "wrestlers"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"segment_participants": {
                  Row: {
                    "created_at": string,"id": string,"outcome": string | null,"role": string,"segment_id": string,"side": number,"team_id": string | null,"universe_id": string,"updated_at": string,"wrestler_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"outcome"?: string | null,"role"?: string,"segment_id": string,"side"?: number,"team_id"?: string | null,"universe_id": string,"updated_at"?: string,"wrestler_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"outcome"?: string | null,"role"?: string,"segment_id"?: string,"side"?: number,"team_id"?: string | null,"universe_id"?: string,"updated_at"?: string,"wrestler_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "segment_participants_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "segment_participants_universe_id_segment_id_fkey"
      columns: ["universe_id","segment_id"]
isOneToOne: false
      referencedRelation: "segments"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "segment_participants_universe_id_team_id_fkey"
      columns: ["universe_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "segment_participants_universe_id_wrestler_id_fkey"
      columns: ["universe_id","wrestler_id"]
isOneToOne: false
      referencedRelation: "wrestlers"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"segment_results": {
                  Row: {
                    "created_at": string,"crowd_reaction": string,"details": NonNullable<Json>,"duration_min": number,"finish": string | null,"manually_edited": boolean,"quality": number,"recap": string,"segment_id": string,"show_id": string,"star_rating": number,"title_changed": boolean,"universe_id": string,"updated_at": string,"winner_side": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"crowd_reaction": string,"details": NonNullable<Json>,"duration_min": number,"finish"?: string | null,"manually_edited"?: boolean,"quality": number,"recap": string,"segment_id": string,"show_id": string,"star_rating": number,"title_changed"?: boolean,"universe_id": string,"updated_at"?: string,"winner_side"?: number | null
                  }
                  Update: {
                    "created_at"?: string,"crowd_reaction"?: string,"details"?: NonNullable<Json>,"duration_min"?: number,"finish"?: string | null,"manually_edited"?: boolean,"quality"?: number,"recap"?: string,"segment_id"?: string,"show_id"?: string,"star_rating"?: number,"title_changed"?: boolean,"universe_id"?: string,"updated_at"?: string,"winner_side"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "segment_results_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "segment_results_universe_id_segment_id_fkey"
      columns: ["universe_id","segment_id"]
isOneToOne: false
      referencedRelation: "segments"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "segment_results_universe_id_show_id_fkey"
      columns: ["universe_id","show_id"]
isOneToOne: false
      referencedRelation: "shows"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"segments": {
                  Row: {
                    "championship_id": string | null,"created_at": string,"custom_kind_label": string,"description": string,"duration_min": number,"finish_plan": string | null,"id": string,"interference": NonNullable<Json>,"kind": string,"match_type": string | null,"position": number,"predetermined_winner_side": number | null,"show_id": string,"stakes": string,"stipulation": string | null,"storyline_id": string | null,"title": string,"title_changes_on_dq": boolean,"tournament_id": string | null,"tournament_round": number | null,"universe_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "championship_id"?: string | null,"created_at"?: string,"custom_kind_label"?: string,"description"?: string,"duration_min"?: number,"finish_plan"?: string | null,"id"?: string,"interference"?: NonNullable<Json>,"kind": string,"match_type"?: string | null,"position": number,"predetermined_winner_side"?: number | null,"show_id": string,"stakes"?: string,"stipulation"?: string | null,"storyline_id"?: string | null,"title"?: string,"title_changes_on_dq"?: boolean,"tournament_id"?: string | null,"tournament_round"?: number | null,"universe_id": string,"updated_at"?: string
                  }
                  Update: {
                    "championship_id"?: string | null,"created_at"?: string,"custom_kind_label"?: string,"description"?: string,"duration_min"?: number,"finish_plan"?: string | null,"id"?: string,"interference"?: NonNullable<Json>,"kind"?: string,"match_type"?: string | null,"position"?: number,"predetermined_winner_side"?: number | null,"show_id"?: string,"stakes"?: string,"stipulation"?: string | null,"storyline_id"?: string | null,"title"?: string,"title_changes_on_dq"?: boolean,"tournament_id"?: string | null,"tournament_round"?: number | null,"universe_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "segments_universe_id_championship_id_fkey"
      columns: ["universe_id","championship_id"]
isOneToOne: false
      referencedRelation: "championships"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "segments_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "segments_universe_id_show_id_fkey"
      columns: ["universe_id","show_id"]
isOneToOne: false
      referencedRelation: "shows"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "segments_universe_id_storyline_id_fkey"
      columns: ["universe_id","storyline_id"]
isOneToOne: false
      referencedRelation: "storylines"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "segments_universe_id_tournament_id_fkey"
      columns: ["universe_id","tournament_id"]
isOneToOne: false
      referencedRelation: "tournaments"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"shows": {
                  Row: {
                    "attendance": number | null,"created_at": string,"custom_type_label": string,"id": string,"name": string,"notes": string,"poster_asset_id": string | null,"promotion_id": string,"rating": number | null,"rating_breakdown": Json | null,"show_date": string,"show_type": string,"sim_seed": string | null,"simulated_at": string | null,"status": string,"target_duration_min": number,"ticket_price": number,"universe_id": string,"updated_at": string,"venue_id": string | null,"version": number
                  }
                  ComputedFields: never
                  Insert: {
                    "attendance"?: number | null,"created_at"?: string,"custom_type_label"?: string,"id"?: string,"name": string,"notes"?: string,"poster_asset_id"?: string | null,"promotion_id": string,"rating"?: number | null,"rating_breakdown"?: Json | null,"show_date": string,"show_type"?: string,"sim_seed"?: string | null,"simulated_at"?: string | null,"status"?: string,"target_duration_min"?: number,"ticket_price"?: number,"universe_id": string,"updated_at"?: string,"venue_id"?: string | null,"version"?: number
                  }
                  Update: {
                    "attendance"?: number | null,"created_at"?: string,"custom_type_label"?: string,"id"?: string,"name"?: string,"notes"?: string,"poster_asset_id"?: string | null,"promotion_id"?: string,"rating"?: number | null,"rating_breakdown"?: Json | null,"show_date"?: string,"show_type"?: string,"sim_seed"?: string | null,"simulated_at"?: string | null,"status"?: string,"target_duration_min"?: number,"ticket_price"?: number,"universe_id"?: string,"updated_at"?: string,"venue_id"?: string | null,"version"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "shows_poster_asset_id_fkey"
      columns: ["poster_asset_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shows_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "shows_universe_id_promotion_id_fkey"
      columns: ["universe_id","promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "shows_universe_id_venue_id_fkey"
      columns: ["universe_id","venue_id"]
isOneToOne: false
      referencedRelation: "venues"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"storyline_developments": {
                  Row: {
                    "created_at": string,"id": string,"intensity_delta": number,"kind": string,"occurred_on": string,"segment_id": string | null,"show_id": string | null,"storyline_id": string,"summary": string,"universe_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"intensity_delta"?: number,"kind"?: string,"occurred_on": string,"segment_id"?: string | null,"show_id"?: string | null,"storyline_id": string,"summary": string,"universe_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"intensity_delta"?: number,"kind"?: string,"occurred_on"?: string,"segment_id"?: string | null,"show_id"?: string | null,"storyline_id"?: string,"summary"?: string,"universe_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "storyline_developments_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "storyline_developments_universe_id_segment_id_fkey"
      columns: ["universe_id","segment_id"]
isOneToOne: false
      referencedRelation: "segments"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "storyline_developments_universe_id_show_id_fkey"
      columns: ["universe_id","show_id"]
isOneToOne: false
      referencedRelation: "shows"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "storyline_developments_universe_id_storyline_id_fkey"
      columns: ["universe_id","storyline_id"]
isOneToOne: false
      referencedRelation: "storylines"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"storyline_participants": {
                  Row: {
                    "created_at": string,"id": string,"role": string,"side": number,"storyline_id": string,"team_id": string | null,"universe_id": string,"updated_at": string,"wrestler_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"role"?: string,"side"?: number,"storyline_id": string,"team_id"?: string | null,"universe_id": string,"updated_at"?: string,"wrestler_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"role"?: string,"side"?: number,"storyline_id"?: string,"team_id"?: string | null,"universe_id"?: string,"updated_at"?: string,"wrestler_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "storyline_participants_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "storyline_participants_universe_id_storyline_id_fkey"
      columns: ["universe_id","storyline_id"]
isOneToOne: false
      referencedRelation: "storylines"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "storyline_participants_universe_id_team_id_fkey"
      columns: ["universe_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "storyline_participants_universe_id_wrestler_id_fkey"
      columns: ["universe_id","wrestler_id"]
isOneToOne: false
      referencedRelation: "wrestlers"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"storylines": {
                  Row: {
                    "auto_progress": boolean,"championship_id": string | null,"created_at": string,"description": string,"id": string,"intensity": number,"kind": string,"objective": string,"promotion_id": string | null,"resolution": string,"resolved_on": string | null,"started_on": string,"status": string,"title": string,"universe_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auto_progress"?: boolean,"championship_id"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"intensity"?: number,"kind"?: string,"objective"?: string,"promotion_id"?: string | null,"resolution"?: string,"resolved_on"?: string | null,"started_on": string,"status"?: string,"title": string,"universe_id": string,"updated_at"?: string
                  }
                  Update: {
                    "auto_progress"?: boolean,"championship_id"?: string | null,"created_at"?: string,"description"?: string,"id"?: string,"intensity"?: number,"kind"?: string,"objective"?: string,"promotion_id"?: string | null,"resolution"?: string,"resolved_on"?: string | null,"started_on"?: string,"status"?: string,"title"?: string,"universe_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "storylines_universe_id_championship_id_fkey"
      columns: ["universe_id","championship_id"]
isOneToOne: false
      referencedRelation: "championships"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "storylines_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "storylines_universe_id_promotion_id_fkey"
      columns: ["universe_id","promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"team_memberships": {
                  Row: {
                    "created_at": string,"id": string,"joined_on": string,"left_on": string | null,"role": string,"team_id": string,"universe_id": string,"updated_at": string,"wrestler_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"joined_on": string,"left_on"?: string | null,"role"?: string,"team_id": string,"universe_id": string,"updated_at"?: string,"wrestler_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"joined_on"?: string,"left_on"?: string | null,"role"?: string,"team_id"?: string,"universe_id"?: string,"updated_at"?: string,"wrestler_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_memberships_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_memberships_universe_id_team_id_fkey"
      columns: ["universe_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "team_memberships_universe_id_wrestler_id_fkey"
      columns: ["universe_id","wrestler_id"]
isOneToOne: false
      referencedRelation: "wrestlers"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"description": string,"disbanded_on": string | null,"experience": number,"formed_on": string,"id": string,"kind": string,"logo_asset_id": string | null,"name": string,"promotion_id": string | null,"universe_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"description"?: string,"disbanded_on"?: string | null,"experience"?: number,"formed_on": string,"id"?: string,"kind": string,"logo_asset_id"?: string | null,"name": string,"promotion_id"?: string | null,"universe_id": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"description"?: string,"disbanded_on"?: string | null,"experience"?: number,"formed_on"?: string,"id"?: string,"kind"?: string,"logo_asset_id"?: string | null,"name"?: string,"promotion_id"?: string | null,"universe_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_logo_asset_id_fkey"
      columns: ["logo_asset_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_universe_id_promotion_id_fkey"
      columns: ["universe_id","promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"timeline_events": {
                  Row: {
                    "championship_id": string | null,"created_at": string,"id": string,"importance": number,"kind": string,"occurred_on": string,"promotion_id": string | null,"segment_id": string | null,"show_id": string | null,"summary": string,"title": string,"universe_id": string,"wrestler_ids": (string)[]
                  }
                  ComputedFields: never
                  Insert: {
                    "championship_id"?: string | null,"created_at"?: string,"id"?: string,"importance"?: number,"kind": string,"occurred_on": string,"promotion_id"?: string | null,"segment_id"?: string | null,"show_id"?: string | null,"summary"?: string,"title": string,"universe_id": string,"wrestler_ids"?: (string)[]
                  }
                  Update: {
                    "championship_id"?: string | null,"created_at"?: string,"id"?: string,"importance"?: number,"kind"?: string,"occurred_on"?: string,"promotion_id"?: string | null,"segment_id"?: string | null,"show_id"?: string | null,"summary"?: string,"title"?: string,"universe_id"?: string,"wrestler_ids"?: (string)[]
                  }
                  Relationships: [
                    {
      foreignKeyName: "timeline_events_universe_id_championship_id_fkey"
      columns: ["universe_id","championship_id"]
isOneToOne: false
      referencedRelation: "championships"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "timeline_events_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "timeline_events_universe_id_promotion_id_fkey"
      columns: ["universe_id","promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "timeline_events_universe_id_segment_id_fkey"
      columns: ["universe_id","segment_id"]
isOneToOne: false
      referencedRelation: "segments"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "timeline_events_universe_id_show_id_fkey"
      columns: ["universe_id","show_id"]
isOneToOne: false
      referencedRelation: "shows"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"title_reign_holders": {
                  Row: {
                    "reign_id": string,"universe_id": string,"wrestler_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "reign_id": string,"universe_id": string,"wrestler_id": string
                  }
                  Update: {
                    "reign_id"?: string,"universe_id"?: string,"wrestler_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "title_reign_holders_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "title_reign_holders_universe_id_reign_id_fkey"
      columns: ["universe_id","reign_id"]
isOneToOne: false
      referencedRelation: "title_reigns"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "title_reign_holders_universe_id_wrestler_id_fkey"
      columns: ["universe_id","wrestler_id"]
isOneToOne: false
      referencedRelation: "wrestlers"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"title_reigns": {
                  Row: {
                    "championship_id": string,"created_at": string,"defenses": number,"end_reason": string | null,"ended_on": string | null,"id": string,"is_manual": boolean,"lost_segment_id": string | null,"notes": string,"started_on": string,"team_id": string | null,"universe_id": string,"updated_at": string,"won_segment_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "championship_id": string,"created_at"?: string,"defenses"?: number,"end_reason"?: string | null,"ended_on"?: string | null,"id"?: string,"is_manual"?: boolean,"lost_segment_id"?: string | null,"notes"?: string,"started_on": string,"team_id"?: string | null,"universe_id": string,"updated_at"?: string,"won_segment_id"?: string | null
                  }
                  Update: {
                    "championship_id"?: string,"created_at"?: string,"defenses"?: number,"end_reason"?: string | null,"ended_on"?: string | null,"id"?: string,"is_manual"?: boolean,"lost_segment_id"?: string | null,"notes"?: string,"started_on"?: string,"team_id"?: string | null,"universe_id"?: string,"updated_at"?: string,"won_segment_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "title_reigns_universe_id_championship_id_fkey"
      columns: ["universe_id","championship_id"]
isOneToOne: false
      referencedRelation: "championships"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "title_reigns_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "title_reigns_universe_id_lost_segment_id_fkey"
      columns: ["universe_id","lost_segment_id"]
isOneToOne: false
      referencedRelation: "segments"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "title_reigns_universe_id_team_id_fkey"
      columns: ["universe_id","team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "title_reigns_universe_id_won_segment_id_fkey"
      columns: ["universe_id","won_segment_id"]
isOneToOne: false
      referencedRelation: "segments"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"tournaments": {
                  Row: {
                    "championship_id": string | null,"created_at": string,"entrant_ids": (string)[],"id": string,"name": string,"promotion_id": string,"round_winners": NonNullable<Json>,"status": string,"universe_id": string,"updated_at": string,"winner_wrestler_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "championship_id"?: string | null,"created_at"?: string,"entrant_ids"?: (string)[],"id"?: string,"name": string,"promotion_id": string,"round_winners"?: NonNullable<Json>,"status"?: string,"universe_id": string,"updated_at"?: string,"winner_wrestler_id"?: string | null
                  }
                  Update: {
                    "championship_id"?: string | null,"created_at"?: string,"entrant_ids"?: (string)[],"id"?: string,"name"?: string,"promotion_id"?: string,"round_winners"?: NonNullable<Json>,"status"?: string,"universe_id"?: string,"updated_at"?: string,"winner_wrestler_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournaments_universe_id_championship_id_fkey"
      columns: ["universe_id","championship_id"]
isOneToOne: false
      referencedRelation: "championships"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "tournaments_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournaments_universe_id_promotion_id_fkey"
      columns: ["universe_id","promotion_id"]
isOneToOne: false
      referencedRelation: "promotions"
      referencedColumns: ["universe_id","id"]
    },{
      foreignKeyName: "tournaments_universe_id_winner_wrestler_id_fkey"
      columns: ["universe_id","winner_wrestler_id"]
isOneToOne: false
      referencedRelation: "wrestlers"
      referencedColumns: ["universe_id","id"]
    }
                  ]
                },"universes": {
                  Row: {
                    "archived_at": string | null,"attribution": NonNullable<Json>,"created_at": string,"description": string,"game_date": string,"id": string,"idempotency_key": string | null,"last_played_at": string,"name": string,"origin": string,"owner_id": string,"revision": number,"schema_version": number,"settings": NonNullable<Json>,"source_creation_id": string | null,"source_version": number | null,"start_date": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"attribution"?: NonNullable<Json>,"created_at"?: string,"description"?: string,"game_date": string,"id"?: string,"idempotency_key"?: string | null,"last_played_at"?: string,"name": string,"origin"?: string,"owner_id"?: string,"revision"?: number,"schema_version"?: number,"settings"?: NonNullable<Json>,"source_creation_id"?: string | null,"source_version"?: number | null,"start_date": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"attribution"?: NonNullable<Json>,"created_at"?: string,"description"?: string,"game_date"?: string,"id"?: string,"idempotency_key"?: string | null,"last_played_at"?: string,"name"?: string,"origin"?: string,"owner_id"?: string,"revision"?: number,"schema_version"?: number,"settings"?: NonNullable<Json>,"source_creation_id"?: string | null,"source_version"?: number | null,"start_date"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_roles": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"role": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"role": string,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"role"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"venues": {
                  Row: {
                    "archived_at": string | null,"capacity": number,"city": string,"created_at": string,"id": string,"image_asset_id": string | null,"name": string,"prestige": number,"region": string,"rental_cost": number,"universe_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"capacity"?: number,"city"?: string,"created_at"?: string,"id"?: string,"image_asset_id"?: string | null,"name": string,"prestige"?: number,"region"?: string,"rental_cost"?: number,"universe_id": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"capacity"?: number,"city"?: string,"created_at"?: string,"id"?: string,"image_asset_id"?: string | null,"name"?: string,"prestige"?: number,"region"?: string,"rental_cost"?: number,"universe_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "venues_image_asset_id_fkey"
      columns: ["image_asset_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "venues_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    }
                  ]
                },"wrestlers": {
                  Row: {
                    "alignment": string,"alternate_name": string,"archived_at": string | null,"big_match": number,"billed_from": string,"biography": string,"birth_date": string | null,"card_position": string,"career_status": string,"charisma": number,"created_at": string,"debut_date": string | null,"division": string,"fatigue": number,"finisher": string,"gender": string,"height_cm": number | null,"id": string,"in_ring": number,"mic_skills": number,"momentum": number,"morale": number,"popularity": number,"portrait_asset_id": string | null,"power": number,"psychology": number,"real_name": string,"reliability": number,"reputation": number,"ring_name": string,"role": string,"selling": number,"speed": number,"stamina": number,"technical": number,"universe_id": string,"updated_at": string,"weight_kg": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "alignment"?: string,"alternate_name"?: string,"archived_at"?: string | null,"big_match"?: number,"billed_from"?: string,"biography"?: string,"birth_date"?: string | null,"card_position"?: string,"career_status"?: string,"charisma"?: number,"created_at"?: string,"debut_date"?: string | null,"division"?: string,"fatigue"?: number,"finisher"?: string,"gender"?: string,"height_cm"?: number | null,"id"?: string,"in_ring"?: number,"mic_skills"?: number,"momentum"?: number,"morale"?: number,"popularity"?: number,"portrait_asset_id"?: string | null,"power"?: number,"psychology"?: number,"real_name"?: string,"reliability"?: number,"reputation"?: number,"ring_name": string,"role"?: string,"selling"?: number,"speed"?: number,"stamina"?: number,"technical"?: number,"universe_id": string,"updated_at"?: string,"weight_kg"?: number | null
                  }
                  Update: {
                    "alignment"?: string,"alternate_name"?: string,"archived_at"?: string | null,"big_match"?: number,"billed_from"?: string,"biography"?: string,"birth_date"?: string | null,"card_position"?: string,"career_status"?: string,"charisma"?: number,"created_at"?: string,"debut_date"?: string | null,"division"?: string,"fatigue"?: number,"finisher"?: string,"gender"?: string,"height_cm"?: number | null,"id"?: string,"in_ring"?: number,"mic_skills"?: number,"momentum"?: number,"morale"?: number,"popularity"?: number,"portrait_asset_id"?: string | null,"power"?: number,"psychology"?: number,"real_name"?: string,"reliability"?: number,"reputation"?: number,"ring_name"?: string,"role"?: string,"selling"?: number,"speed"?: number,"stamina"?: number,"technical"?: number,"universe_id"?: string,"updated_at"?: string,"weight_kg"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "wrestlers_portrait_asset_id_fkey"
      columns: ["portrait_asset_id"]
isOneToOne: false
      referencedRelation: "media_assets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "wrestlers_universe_id_fkey"
      columns: ["universe_id"]
isOneToOne: false
      referencedRelation: "universes"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "creator_stats": {
                  Row: {
                    "creator_id": string | null,"published_count": number | null,"total_downloads": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "active_creation_count":
{ Args: { "p_user": string }; Returns: number
                           },
"apply_world_changes":
{ Args: { "p_changes": Json,"p_universe": string }; Returns: Json
                           },
"can_view_creation":
{ Args: { "p_creation": string }; Returns: boolean
                           },
"consume_rate_limit":
{ Args: { "p_action": string,"p_max": number,"p_window": string }; Returns: number
                           },
"creation_is_public":
{ Args: { "p_creation": string }; Returns: boolean
                           },
"creation_needs_review":
{ Args: { "p_description": string,"p_has_media": boolean,"p_summary": string,"p_tags": (string)[],"p_title": string }; Returns: string
                           },
"decide_appeal":
{ Args: { "p_appeal": string,"p_note": string,"p_uphold": boolean }; Returns: undefined
                           },
"delete_creation":
{ Args: { "p_creation": string }; Returns: (string)[]
                           },
"dev_set_entitlement_state":
{ Args: { "p_state": string }; Returns: string
                           },
"effective_plan":
{ Args: { "p_user": string }; Returns: string
                           },
"feature_limit":
{ Args: { "p_feature": string,"p_user": string }; Returns: number
                           },
"file_report":
{ Args: { "p_category": string,"p_creation": string,"p_details": string,"p_target_type": string,"p_user": string }; Returns: string
                           },
"get_universe_snapshot":
{ Args: { "p_collections"?: (string)[],"p_history_from"?: string,"p_universe": string }; Returns: Json
                           },
"has_role":
{ Args: { "p_role": string }; Returns: boolean
                           },
"import_universe_rows":
{ Args: { "p_rows": Json,"p_universe": Json,"p_universe_id": string }; Returns: string
                           },
"is_moderator":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_restricted":
{ Args: { "p_kind": string,"p_user": string }; Returns: boolean
                           },
"lift_restriction":
{ Args: { "p_reason": string,"p_restriction": string }; Returns: undefined
                           },
"media_bytes_used":
{ Args: { "p_user": string }; Returns: number
                           },
"moderate_creation":
{ Args: { "p_action": string,"p_creation": string,"p_reason": string,"p_report"?: string }; Returns: string
                           },
"my_entitlements":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"owns_universe":
{ Args: { "p_universe": string }; Returns: boolean
                           },
"public_asset_visible":
{ Args: { "p_asset": string }; Returns: boolean
                           },
"publish_creation":
{ Args: { "p_allow_derivatives": boolean,"p_category": string,"p_changelog": string,"p_creation": string,"p_description": string,"p_entity_counts": Json,"p_is_fan_content": boolean,"p_lineage": Json,"p_media": (string)[],"p_package": Json,"p_package_bytes": number,"p_schema_version": number,"p_source_creation": string,"p_source_version": number,"p_summary": string,"p_tags": (string)[],"p_thumbnail": string,"p_title": string,"p_visibility": string }; Returns: {
              "creation_id": string,"moderation_state": string,"review_reason": string,"version": number
            }[]
                           },
"rate_creation":
{ Args: { "p_creation": string,"p_stars": number }; Returns: {
              "rating_count": number,"rating_sum": number
            }[]
                           },
"record_creation_download":
{ Args: { "p_creation": string,"p_version": number }; Returns: number
                           },
"remove_creation_rating":
{ Args: { "p_creation": string }; Returns: undefined
                           },
"resolve_report":
{ Args: { "p_note": string,"p_report": string,"p_resolution": string }; Returns: undefined
                           },
"resolve_takedown":
{ Args: { "p_note": string,"p_request": string,"p_status": string }; Returns: undefined
                           },
"restrict_account":
{ Args: { "p_days"?: number,"p_kind": string,"p_reason": string,"p_user": string }; Returns: string
                           },
"set_user_role":
{ Args: { "p_grant": boolean,"p_reason": string,"p_role": string,"p_user": string }; Returns: undefined
                           },
"simulate_batch":
{ Args: { "p_expected_revision": number,"p_rows": Json,"p_steps": Json,"p_universe": string }; Returns: Json
                           },
"submit_appeal":
{ Args: { "p_creation": string,"p_message": string }; Returns: string
                           },
"submit_takedown":
{ Args: { "p_accuracy": boolean,"p_claimant_email": string,"p_claimant_name": string,"p_claimant_organization": string,"p_creation": string,"p_good_faith": boolean,"p_infringing_url": string,"p_relationship": string,"p_signature": string,"p_work_description": string }; Returns: string
                           },
"wrestler_records":
{ Args: { "p_universe": string }; Returns: {
              "draws": number,"losses": number,"matches": number,"wins": number,"wrestler_id": string
            }[]
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
