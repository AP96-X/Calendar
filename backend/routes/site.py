# -*- coding: utf-8 -*-
"""站点信息接口 —— 备案号等公开信息"""
from flask import Blueprint, jsonify

from ..settings_store import get_site_info

site_bp = Blueprint('site', __name__)


@site_bp.route('/api/site/info')
def site_info():
    """返回站点公开信息（备案号等），无需登录。

    备案号由管理员在「管理 → 系统设置」中维护，数据库优先、环境变量兜底。
    """
    return jsonify(get_site_info())
