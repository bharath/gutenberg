/* eslint no-console: [ 'error', { allow: [ 'error' ] } ] */

/**
 * External dependencies
 */
import {
	get,
	omit,
	pick,
	isFunction,
	isPlainObject,
	some,
} from 'lodash';

/**
 * WordPress dependencies
 */
import { applyFilters } from '@wordpress/hooks';
import { select, dispatch } from '@wordpress/data';

/**
 * Internal dependencies
 */
import { isValidIcon, normalizeIconObject } from './utils';
import { DEPRECATED_ENTRY_KEYS } from './constants';

/**
 * An icon type definition. One of a Dashicon slug, an element,
 * or a component.
 *
 * @typedef {(string|WPElement|WPComponent)} WPIcon
 *
 * @see https://developer.wordpress.org/resource/dashicons/
 */

/**
 * Render behavior of a block type icon; one of a Dashicon slug, an element,
 * or a component.
 *
 * @typedef {WPIcon} WPBlockTypeIconRender
 */

/**
 * An object describing a normalized block type icon.
 *
 * @typedef {Object} WPBlockTypeIconDescriptor
 *
 * @property {WPBlockTypeIconRender} src         Render behavior of the icon,
 *                                               one of a Dashicon slug, an
 *                                               element, or a component.
 * @property {string}                background  Optimal background hex string
 *                                               color when displaying icon.
 * @property {string}                foreground  Optimal foreground hex string
 *                                               color when displaying icon.
 * @property {string}                shadowColor Optimal shadow hex string
 *                                               color when displaying icon.
 */

/**
 * Value to use to render the icon for a block type in an editor interface,
 * either a Dashicon slug, an element, a component, or an object describing
 * the icon.
 *
 * @typedef {(WPBlockTypeIconDescriptor|WPBlockTypeIconRender)} WPBlockTypeIcon
 */

/**
 * An object describing a pattern defined for the block type.
 *
 * @typedef {Object} WPBlockPattern
 *
 * @property {string}  name          The unique and machine-readable name.
 * @property {string}  label         A human-readable label.
 * @property {WPIcon}  [icon]        An icon helping to visualize the pattern.
 * @property {boolean} [isDefault]   Indicates whether the current pattern is the default one.
 *                                   Defaults to `false`.
 * @property {Object}  [attributes]  Values which override block attributes.
 * @property {Array[]} [innerBlocks] Initial configuration of nested blocks.
 */

/**
 * Defined behavior of a block type.
 *
 * @typedef {Object} WPBlock
 *
 * @property {string}           name         Block type's namespaced name.
 * @property {string}           title        Human-readable block type label.
 * @property {string}           category     Block type category classification,
 *                                           used in search interfaces to arrange
 *                                           block types by category.
 * @property {WPBlockTypeIcon}  [icon]       Block type icon.
 * @property {string[]}         [keywords]   Additional keywords to produce block
 *                                           type as result in search interfaces.
 * @property {Object}           [attributes] Block type attributes.
 * @property {WPComponent}      [save]       Optional component describing
 *                                           serialized markup structure of a
 *                                           block type.
 * @property {WPComponent}      edit         Component rendering an element to
 *                                           manipulate the attributes of a block
 *                                           in the context of an editor.
 * @property {WPBlockPattern[]} [patterns]   The list of block patterns.
 */

/**
 * Default values to assign for omitted optional block type settings.
 *
 * @type {Object}
 */
export const DEFAULT_BLOCK_TYPE_SETTINGS = {
	icon: 'block-default',
	attributes: {},
	keywords: [],
	save: () => null,
};

export let serverSideBlockDefinitions = {};

/**
 * Sets the server side block definition of blocks.
 *
 * @param {Object} definitions Server-side block definitions
 */
export function unstable__bootstrapServerSideBlockDefinitions( definitions ) { // eslint-disable-line camelcase
	serverSideBlockDefinitions = {
		...serverSideBlockDefinitions,
		...definitions,
	};
}

/**
 * Registers a new block provided a unique name and an object defining its
 * behavior. Once registered, the block is made available as an option to any
 * editor interface where blocks are implemented.
 *
 * @param {string} name     Block name.
 * @param {Object} settings Block settings.
 *
 * @return {?WPBlock} The block, if it has been successfully registered;
 *                    otherwise `undefined`.
 */
export function registerBlockType( name, settings ) {
	settings = {
		name,
		...DEFAULT_BLOCK_TYPE_SETTINGS,
		...get( serverSideBlockDefinitions, name ),
		...settings,
	};

	if ( typeof name !== 'string' ) {
		console.error(
			'Block names must be strings.'
		);
		return;
	}
	if ( ! /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/.test( name ) ) {
		console.error(
			'Block names must contain a namespace prefix, include only lowercase alphanumeric characters or dashes, and start with a letter. Example: my-plugin/my-custom-block'
		);
		return;
	}
	if ( select( 'core/blocks' ).getBlockType( name ) ) {
		console.error(
			'Block "' + name + '" is already registered.'
		);
		return;
	}

	const preFilterSettings = { ...settings };
	settings = applyFilters( 'blocks.registerBlockType', settings, name );

	/** GLOBAL STYLES ENHANCEMENT START */
	if ( ! settings.attributes.styledClassName ) {
		settings.attributes.styledClassName = {
			type: 'string',
		};
	}
	/** GLOBAL STYLES ENHANCEMENT END */

	if ( settings.deprecated ) {
		settings.deprecated = settings.deprecated.map( ( deprecation ) =>
			pick( // Only keep valid deprecation keys.
				applyFilters(
					'blocks.registerBlockType',
					// Merge deprecation keys with pre-filter settings
					// so that filters that depend on specific keys being
					// present don't fail.
					{
						// Omit deprecation keys here so that deprecations
						// can opt out of specific keys like "supports".
						...omit( preFilterSettings, DEPRECATED_ENTRY_KEYS ),
						...deprecation,
					},
					name
				),
				DEPRECATED_ENTRY_KEYS
			)
		);
	}

	if ( ! isPlainObject( settings ) ) {
		console.error(
			'Block settings must be a valid object.'
		);
		return;
	}

	if ( ! isFunction( settings.save ) ) {
		console.error(
			'The "save" property must be a valid function.'
		);
		return;
	}
	if ( 'edit' in settings && ! isFunction( settings.edit ) ) {
		console.error(
			'The "edit" property must be a valid function.'
		);
		return;
	}
	if ( ! ( 'category' in settings ) ) {
		console.error(
			'The block "' + name + '" must have a category.'
		);
		return;
	}
	if (
		'category' in settings &&
		! some( select( 'core/blocks' ).getCategories(), { slug: settings.category } )
	) {
		console.error(
			'The block "' + name + '" must have a registered category.'
		);
		return;
	}
	if ( ! ( 'title' in settings ) || settings.title === '' ) {
		console.error(
			'The block "' + name + '" must have a title.'
		);
		return;
	}
	if ( typeof settings.title !== 'string' ) {
		console.error(
			'Block titles must be strings.'
		);
		return;
	}

	settings.icon = normalizeIconObject( settings.icon );
	if ( ! isValidIcon( settings.icon.src ) ) {
		console.error(
			'The icon passed is invalid. ' +
			'The icon should be a string, an element, a function, or an object following the specifications documented in https://developer.wordpress.org/block-editor/developers/block-api/block-registration/#icon-optional'
		);
		return;
	}

	dispatch( 'core/blocks' ).addBlockTypes( settings );

	return settings;
}

/**
 * Registers a new block collection to group blocks in the same namespace in the inserter.
 *
 * @param {string} namespace The namespace to group blocks by in the inserter; corresponds to the block namespace
 * @param {Object} settings  An object composed of a title to show in the inserter, and an icon to show in the inserter
 *
 */
export function registerBlockCollection( namespace, { title, icon } ) {
	dispatch( 'core/blocks' ).addBlockCollection( namespace, title, icon );
}

/**
 * Unregisters a block collection
 *
 * @param {string} namespace The namespace to group blocks by in the inserter; corresponds to the block namespace
 *
 */
export function unregisterBlockCollection( namespace ) {
	dispatch( 'core/blocks' ).removeBlockCollection( namespace );
}

/**
 * Unregisters a block.
 *
 * @param {string} name Block name.
 *
 * @return {?WPBlock} The previous block value, if it has been successfully
 *                    unregistered; otherwise `undefined`.
 */
export function unregisterBlockType( name ) {
	const oldBlock = select( 'core/blocks' ).getBlockType( name );
	if ( ! oldBlock ) {
		console.error(
			'Block "' + name + '" is not registered.'
		);
		return;
	}
	dispatch( 'core/blocks' ).removeBlockTypes( name );
	return oldBlock;
}

/**
 * Assigns name of block for handling non-block content.
 *
 * @param {string} blockName Block name.
 */
export function setFreeformContentHandlerName( blockName ) {
	dispatch( 'core/blocks' ).setFreeformFallbackBlockName( blockName );
}

/**
 * Retrieves name of block handling non-block content, or undefined if no
 * handler has been defined.
 *
 * @return {?string} Block name.
 */
export function getFreeformContentHandlerName() {
	return select( 'core/blocks' ).getFreeformFallbackBlockName();
}

/**
 * Retrieves name of block used for handling grouping interactions.
 *
 * @return {?string} Block name.
 */
export function getGroupingBlockName() {
	return select( 'core/blocks' ).getGroupingBlockName();
}

/**
 * Assigns name of block handling unregistered block types.
 *
 * @param {string} blockName Block name.
 */
export function setUnregisteredTypeHandlerName( blockName ) {
	dispatch( 'core/blocks' ).setUnregisteredFallbackBlockName( blockName );
}

/**
 * Retrieves name of block handling unregistered block types, or undefined if no
 * handler has been defined.
 *
 * @return {?string} Block name.
 */
export function getUnregisteredTypeHandlerName() {
	return select( 'core/blocks' ).getUnregisteredFallbackBlockName();
}

/**
 * Assigns the default block name.
 *
 * @param {string} name Block name.
 */
export function setDefaultBlockName( name ) {
	dispatch( 'core/blocks' ).setDefaultBlockName( name );
}

/**
 * Assigns name of block for handling block grouping interactions.
 *
 * @param {string} name Block name.
 */
export function setGroupingBlockName( name ) {
	dispatch( 'core/blocks' ).setGroupingBlockName( name );
}

/**
 * Retrieves the default block name.
 *
 * @return {?string} Block name.
 */
export function getDefaultBlockName() {
	return select( 'core/blocks' ).getDefaultBlockName();
}

/**
 * Returns a registered block type.
 *
 * @param {string} name Block name.
 *
 * @return {?Object} Block type.
 */
export function getBlockType( name ) {
	return select( 'core/blocks' ).getBlockType( name );
}

/**
 * Returns all registered blocks.
 *
 * @return {Array} Block settings.
 */
export function getBlockTypes() {
	return select( 'core/blocks' ).getBlockTypes();
}

/**
 * Returns the block support value for a feature, if defined.
 *
 * @param  {(string|Object)} nameOrType      Block name or type object
 * @param  {string}          feature         Feature to retrieve
 * @param  {*}               defaultSupports Default value to return if not
 *                                           explicitly defined
 *
 * @return {?*} Block support value
 */
export function getBlockSupport( nameOrType, feature, defaultSupports ) {
	return select( 'core/blocks' ).getBlockSupport( nameOrType, feature, defaultSupports );
}

/**
 * Returns true if the block defines support for a feature, or false otherwise.
 *
 * @param {(string|Object)} nameOrType      Block name or type object.
 * @param {string}          feature         Feature to test.
 * @param {boolean}         defaultSupports Whether feature is supported by
 *                                          default if not explicitly defined.
 *
 * @return {boolean} Whether block supports feature.
 */
export function hasBlockSupport( nameOrType, feature, defaultSupports ) {
	return select( 'core/blocks' ).hasBlockSupport( nameOrType, feature, defaultSupports );
}

/**
 * Determines whether or not the given block is a reusable block. This is a
 * special block type that is used to point to a global block stored via the
 * API.
 *
 * @param {Object} blockOrType Block or Block Type to test.
 *
 * @return {boolean} Whether the given block is a reusable block.
 */
export function isReusableBlock( blockOrType ) {
	return blockOrType.name === 'core/block';
}

/**
 * Returns an array with the child blocks of a given block.
 *
 * @param {string} blockName Name of block (example: “latest-posts”).
 *
 * @return {Array} Array of child block names.
 */
export const getChildBlockNames = ( blockName ) => {
	return select( 'core/blocks' ).getChildBlockNames( blockName );
};

/**
 * Returns a boolean indicating if a block has child blocks or not.
 *
 * @param {string} blockName Name of block (example: “latest-posts”).
 *
 * @return {boolean} True if a block contains child blocks and false otherwise.
 */
export const hasChildBlocks = ( blockName ) => {
	return select( 'core/blocks' ).hasChildBlocks( blockName );
};

/**
 * Returns a boolean indicating if a block has at least one child block with inserter support.
 *
 * @param {string} blockName Block type name.
 *
 * @return {boolean} True if a block contains at least one child blocks with inserter support
 *                   and false otherwise.
 */
export const hasChildBlocksWithInserterSupport = ( blockName ) => {
	return select( 'core/blocks' ).hasChildBlocksWithInserterSupport( blockName );
};

/**
 * Registers a new block style variation for the given block.
 *
 * @param {string} blockName      Name of block (example: “core/latest-posts”).
 * @param {Object} styleVariation Object containing `name` which is the class name applied to the block and `label` which identifies the variation to the user.
 */
export const registerBlockStyle = ( blockName, styleVariation ) => {
	dispatch( 'core/blocks' ).addBlockStyles( blockName, styleVariation );
};

/**
 * Unregisters a block style variation for the given block.
 *
 * @param {string} blockName          Name of block (example: “core/latest-posts”).
 * @param {string} styleVariationName Name of class applied to the block.
 */
export const unregisterBlockStyle = ( blockName, styleVariationName ) => {
	dispatch( 'core/blocks' ).removeBlockStyles( blockName, styleVariationName );
};

/**
 * Registers a new block pattern for the given block.
 *
 * @param {string}         blockName Name of the block (example: “core/columns”).
 * @param {WPBlockPattern} pattern   Object describing a block pattern.
 */
export const __experimentalRegisterBlockPattern = ( blockName, pattern ) => {
	dispatch( 'core/blocks' ).__experimentalAddBlockPatterns( blockName, pattern );
};

/**
 * Unregisters a block pattern defined for the given block.
 *
 * @param {string} blockName   Name of the block (example: “core/columns”).
 * @param {string} patternName Name of the pattern defined for the block.
 */
export const __experimentalUnregisterBlockPattern = ( blockName, patternName ) => {
	dispatch( 'core/blocks' ).__experimentalRemoveBlockPatterns( blockName, patternName );
};
