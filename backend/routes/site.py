# -*- coding: utf-8 -*-
"""站点信息接口 —— 备案号等公开信息"""
from flask import Blueprint, jsonify
from ..config import ICP_NUMBER, PUBLIC_SECURITY_NUMBER

site_bp = Blueprint('site', __name__)


@site_bp.route('/api/site/info')
def site_info():
    """返回站点公开信息（备案号等），无需登录"""
    return jsonify({
        'icp_number': ICP_NUMBER,
        'public_security_number': PUBLIC_SECURITY_NUMBER,
    })
