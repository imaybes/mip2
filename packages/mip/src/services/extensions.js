import Services from './services'
import {templates, Deferred} from '../util'
import registerMip1Element from '../mip1-polyfill/element'
import registerCustomElement from '../register-element'
import registerVueCustomElement from '../vue-custom-element'

export class Extensions {
  /**
   * @param {!Window} win
   */
  constructor (win) {
    /**
     * @private
     * @const
     */
    this.win = win

    /**
     * @type {!Object}
     * @private
     */
    this.extensions = {}

    /**
     * @type {?string}
     * @private
     */
    this.currentExtensionId = null

    /**
     * An empty constructor, only used as a placeholder in `registerElement`.
     *
     * @private
     * @const
     */
    this.emptyService = class {}

    /**
     * @private
     * @const
     */
    this.mipdoc = Services.mipdocFor(win)

    /**
     * Binds methods exposed to `MIP`.
     */
    this.installExtension = this.installExtension.bind(this)
    this.registerElement = this.registerElement.bind(this)
    this.registerService = this.registerService.bind(this)
    this.registerTemplate = this.registerTemplate.bind(this)
  }

  /**
   * Returns or creates extension holder for `extensionId`.
   *
   * @param {string} extensionId of extension.
   * @returns {!Object}
   * @private
   */
  getExtensionHolder (extensionId) {
    let holder = this.extensions[extensionId]

    if (!holder) {
      const extension = {
        elements: {},
        services: {}
      }

      holder = this.extensions[extensionId] = {
        extension,
        promise: null,
        resolve: null,
        reject: null,
        loaded: null,
        error: null
      }
    }

    return holder
  }

  /**
   * Returns holder for extension which is currently being registered.
   *
   * @returns {!Object}
   * @private
   */
  getCurrentExtensionHolder () {
    return this.getExtensionHolder(this.currentExtensionId)
  }

  /**
   * Returns or creates a promise waiting for extension loaded.
   *
   * @template T typeof extension.
   * @param {!Object} holder of extension.
   * @returns {!Promise<T>}
   * @private
   */
  waitFor (holder) {
    if (!holder.promise) {
      if (holder.loaded) {
        holder.promise = Promise.resolve(holder.extension)
      } else if (holder.error) {
        holder.promise = Promise.reject(holder.error)
      } else {
        const {promise, resolve, reject} = new Deferred()

        holder.promise = promise
        holder.resolve = resolve
        holder.reject = reject
      }
    }

    return holder.promise
  }

  /**
   * Returns or creates a promise waiting for extension loaded.
   *
   * @template T typeof extension.
   * @param {string} extensionId of extension.
   * @returns {!Promise<T>}
   */
  waitForExtension (extensionId) {
    return this.waitFor(this.getExtensionHolder(extensionId))
  }

  /**
   * Preloads an extension as a dependency of others.
   *
   * @template T typeof extension.
   * @param {string} extensionId of extension.
   * @returns {!Promise<T>}
   */
  preloadExtension (extensionId) {
    return this.waitForExtension(extensionId)
  }

  /**
   * Loads dependencies before the extension itself.
   *
   * @param {!Object} extension
   * @returns {!Promise<Object>}
   * @private
   */
  preloadDepsOf (extension) {
    if (Array.isArray(extension.deps)) {
      return Promise.all(extension.deps.map(dep => this.preloadExtension(dep)))
    }

    if (typeof extension.deps === 'string') {
      return this.preloadExtension(extension.deps)
    }

    return Promise.resolve()
  }

  /**
   * Registers an extension in extension holder.
   * An extension factory may include multiple registration methods,
   * such as `registerElement`, `registerService` or `registerTemplate`.
   *
   * @param {string} extensionId of extension.
   * @param {!Function} factory of extension.
   * @param  {...Object} args passed to extension factory.
   * @private
   */
  registerExtension (extensionId, factory, ...args) {
    const holder = this.getExtensionHolder(extensionId)

    try {
      this.currentExtensionId = extensionId
      factory(...args)
      holder.loaded = true

      if (holder.resolve) {
        holder.resolve(holder.extension)
      }
    } catch (err) {
      holder.error = err

      if (holder.reject) {
        holder.reject(err)
      }

      throw err
    } finally {
      this.currentExtensionId = null
    }
  }

  /**
   * Installs an extension. The same as `MIP.push`.
   *
   * @param {!Object} extension
   * @returns {!Promise<void>}
   */
  installExtension (extension) {
    return Promise.all([
      this.preloadDepsOf(extension),
      this.mipdoc.whenBodyAvailable()
    ]).then(
      () => this.registerExtension(extension.name, extension.func, this.win.MIP)
    )
  }

  /**
   * Returns the appropriate registrator for an element.
   * An element implementation could be a class written in native JavaScript or a Vue object.
   * If `element.version === '1'`, then it will fallback to the registration of MIP1 elements.
   *
   * @param {!Object} element contains implementation, css and version.
   * @returns {!function(string, !Function | !Object, string)}
   * @private
   */
  getElementRegistrator (element) {
    if (element.version && element.version.split('.')[0] === '1') {
      return registerMip1Element
    }

    if (typeof element.implementation === 'object') {
      return registerVueCustomElement
    }

    return registerCustomElement
  }

  /**
   * Registers an element in extension currently being registered (by calling `MIP.push`).
   *
   * @param {string} name
   * @param {!Function | !Object} implementation
   * @param {string=} css
   * @param {Object=} options
   */
  registerElement (name, implementation, css, options) {
    const holder = this.getCurrentExtensionHolder()
    const element = {implementation, css}
    const version = options && options.version && '' + options.version

    if (version) {
      element.version = version
    }

    holder.extension.elements[name] = element

    this.getElementRegistrator(element)(name, implementation, css)

    /**
     * Registers an empty service to resolve the possible pending promise.
     */
    Services.registerService(this.win, name, this.emptyService)
  }

  /**
   * Registers a service in extension currently being registered (by calling `MIP.push`).
   * A service in extension is still a class contains some useful functions,
   * it's no conceptual difference with other internal services.
   *
   * @param {string} name
   * @param {!Function} implementation
   */
  registerService (name, implementation) {
    const holder = this.getCurrentExtensionHolder()

    holder.extension.services[name] = {implementation}

    Services.registerService(this.win, name, implementation)
  }

  /**
   * Registers a template in extension currently being registered (by calling `MIP.push`).
   *
   * @param {string} name
   * @param {!Function} implementation
   * @param {Object=} options
   */
  registerTemplate (name, implementation, options) {
    templates.register(name, implementation)
  }
}

/**
 * @param {!Window} win
 */
export function installExtensionsService (win) {
  Services.registerService(win, 'extensions', Extensions)
}