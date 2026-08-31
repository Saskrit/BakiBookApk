import User from '../models/User.js';
import ShopMembership from '../models/ShopMembership.js';
import {
  generateLockedInvitePassword,
  issueInviteLoginCode,
} from '../utils/inviteLogin.js';
import { requireShopOwner } from '../utils/shopContext.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const formatMember = (membership, memberUser) => ({
  id: memberUser._id.toString(),
  membershipId: membership._id.toString(),
  fullName: memberUser.fullName,
  email: memberUser.email,
  profileImage: memberUser.profileImage || '',
  teamRole: membership.teamRole,
  status: membership.status,
  invitedAt: membership.createdAt,
});

export const listShopTeam = async (req, res) => {
  try {
    if (!req.canEditShop) {
      return res.status(403).json({
        success: false,
        message: 'Only the shop owner can view the team list',
      });
    }

    const memberships = await ShopMembership.find({
      shopOwner: req.user._id,
      status: 'active',
    })
      .populate('member', 'fullName email profileImage')
      .sort({ createdAt: -1 });

    const members = memberships
      .filter((m) => m.member)
      .map((m) => formatMember(m, m.member));

    return res.json({
      success: true,
      members,
      owner: {
        id: req.user._id.toString(),
        fullName: req.user.fullName,
        email: req.user.email,
        teamRole: 'owner',
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load team',
    });
  }
};

export const inviteShopTeamMember = [
  requireShopOwner,
  async (req, res) => {
    try {
      const { email, teamRole } = req.body;
      const normalizedEmail = email?.trim()?.toLowerCase();
      const role = teamRole === 'partner' ? 'partner' : teamRole === 'staff' ? 'staff' : null;

      if (!normalizedEmail || !emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'Valid email is required' });
      }
      if (!role) {
        return res.status(400).json({
          success: false,
          message: 'teamRole must be partner or staff',
        });
      }
      if (normalizedEmail === req.user.email?.toLowerCase()) {
        return res.status(400).json({
          success: false,
          message: 'You cannot invite your own email',
        });
      }

      const lockedPassword = generateLockedInvitePassword();
      let member = await User.findOne({ email: normalizedEmail, role: 'shopkeeper' });

      if (member) {
        if (!member.shopOwner || String(member.shopOwner) === String(req.user._id)) {
          // ok — same shop or not yet linked
        } else if (member.shopOwner && String(member.shopOwner) !== String(req.user._id)) {
          return res.status(409).json({
            success: false,
            message: 'This email already belongs to another shop team',
          });
        }

        if (!member.shopOwner && member.teamRole === 'owner') {
          const ownsShopData =
            Boolean(member.shopName?.trim()) || Boolean(member.isShopVerified);
          if (ownsShopData || String(member._id) === String(req.user._id)) {
            return res.status(409).json({
              success: false,
              message:
                'This email already has a shopkeeper account. Ask them to use a different email for team access.',
            });
          }
        }
      }

      if (!member) {
        const localPart = normalizedEmail.split('@')[0] || 'Team member';
        member = await User.create({
          role: 'shopkeeper',
          fullName: localPart.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          email: normalizedEmail,
          password: lockedPassword,
          authProvider: 'local',
          isEmailVerified: true,
          mustChangePassword: true,
          shopOwner: req.user._id,
          teamRole: role,
        });
      } else {
        member.mustChangePassword = true;
        member.password = lockedPassword;
        member.shopOwner = req.user._id;
        member.teamRole = role;
        member.isEmailVerified = true;
        await member.save();
      }

      const membership = await ShopMembership.findOneAndUpdate(
        { shopOwner: req.user._id, member: member._id },
        {
          shopOwner: req.user._id,
          member: member._id,
          teamRole: role,
          status: 'active',
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      await issueInviteLoginCode(member, {
        ownerName: req.user.fullName,
        shopName: req.user.shopName || 'BakiBook shop',
        teamRole: role,
      });

      return res.status(201).json({
        success: true,
        message: `Invite sent to ${normalizedEmail}. They must use the email code for first login.`,
        member: formatMember(membership, member),
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'This email is already registered for that role',
        });
      }
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to invite team member',
      });
    }
  },
];

export const revokeShopTeamMember = [
  requireShopOwner,
  async (req, res) => {
    try {
      const memberId = req.params.memberId;
      const membership = await ShopMembership.findOne({
        shopOwner: req.user._id,
        member: memberId,
        status: 'active',
      });

      if (!membership) {
        return res.status(404).json({
          success: false,
          message: 'Team member not found',
        });
      }

      membership.status = 'revoked';
      await membership.save();

      const member = await User.findById(memberId);
      if (member && String(member.shopOwner) === String(req.user._id)) {
        member.shopOwner = undefined;
        member.teamRole = 'owner';
        member.mustChangePassword = false;
        member.inviteLoginCodeHash = undefined;
        member.inviteLoginCodeExpires = undefined;
        member.inviteLoginAttempts = 0;
        await member.save();
      }

      return res.json({
        success: true,
        message: 'Team member removed',
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to remove team member',
      });
    }
  },
];
